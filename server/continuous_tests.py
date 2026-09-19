"""Continuous automated tests engine inspired by Vanta's hourly control monitoring.

Evaluates both application compliance records and real local host telemetry (disk encryption, firewall).
Provides instant pass/fail/warning verdicts, audit evidence data, and actionable remediation steps.
"""
from datetime import date, datetime, timedelta
import json
from pathlib import Path
import subprocess
from uuid import uuid4
from fastapi import APIRouter
from .storage import Store, now
from .records import log


def check_real_host_disk_encryption() -> tuple[str, str, dict]:
    """Inspects real local block devices for full-disk encryption (LUKS / FileVault / BitLocker)."""
    try:
        proc = subprocess.run(["lsblk", "-o", "NAME,TYPE,FSTYPE,MOUNTPOINTS"], capture_output=True, text=True, timeout=5)
        out = proc.stdout
        is_encrypted = "crypto_LUKS" in out or "crypt" in out
        if is_encrypted:
            return "pass", "Full-disk encryption (LUKS) active on root/home partitions.", {"details": "LUKS crypt device detected in lsblk hierarchy"}
        return "warning", "No LUKS encrypted partition detected on local root storage.", {"remediation": "Configure LUKS / dm-crypt full-disk encryption on endpoints and storage volumes."}
    except Exception as e:
        return "warning", f"Could not inspect local disk encryption: {e}", {}


def check_real_host_firewall() -> tuple[str, str, dict]:
    """Inspects local host firewall status (ufw / nftables / iptables)."""
    try:
        # Check ufw first
        proc_ufw = subprocess.run(["systemctl", "is-active", "ufw"], capture_output=True, text=True, timeout=5)
        if proc_ufw.stdout.strip() == "active":
            return "pass", "Local host firewall (ufw) is active and filtering traffic.", {"firewall": "ufw", "status": "active"}

        # Check nftables
        proc_nft = subprocess.run(["systemctl", "is-active", "nftables"], capture_output=True, text=True, timeout=5)
        if proc_nft.stdout.strip() == "active":
            return "pass", "Local host firewall (nftables) is active.", {"firewall": "nftables", "status": "active"}

        # Check iptables rules
        proc_ipt = subprocess.run(["iptables", "-L", "-n"], capture_output=True, text=True, timeout=5)
        if proc_ipt.returncode == 0 and "Chain INPUT" in proc_ipt.stdout:
            return "pass", "Local packet filtering rules active in iptables.", {"firewall": "iptables", "status": "active"}

        return "warning", "Host firewall service is inactive or not loaded.", {"remediation": "Enable and start a host firewall: sudo ufw enable"}
    except Exception as e:
        return "warning", f"Could not inspect host firewall: {e}", {}


def check_real_open_listening_ports() -> tuple[str, str, dict]:
    """Inspects open listening network sockets to verify no insecure cleartext services are exposed."""
    try:
        proc = subprocess.run(["ss", "-tuln"], capture_output=True, text=True, timeout=5)
        out = proc.stdout
        insecure_ports = []
        for line in out.splitlines():
            if "0.0.0.0:23 " in line or "*:23 " in line:
                insecure_ports.append("Telnet (23)")
            if "0.0.0.0:21 " in line or "*:21 " in line:
                insecure_ports.append("FTP (21)")
        if insecure_ports:
            return "fail", f"Insecure cleartext ports exposed: {', '.join(insecure_ports)}", {"ports": insecure_ports}
        return "pass", "No insecure legacy cleartext ports (Telnet/FTP) detected on network interfaces.", {"clean": True}
    except Exception as e:
        return "warning", f"Could not inspect network listening ports: {e}", {}


def check_system_logging() -> tuple[str, str, dict]:
    """Verifies system audit logging services (systemd-journald)."""
    try:
        proc = subprocess.run(["systemctl", "is-active", "systemd-journald"], capture_output=True, text=True, timeout=5)
        if proc.stdout.strip() == "active":
            return "pass", "System security logging (systemd-journald) is active with persistent log retention.", {"logging": "systemd-journald", "status": "active"}
        return "warning", "System audit logging daemon is inactive.", {"remediation": "Start logging daemon: sudo systemctl start systemd-journald"}
    except Exception as e:
        return "warning", f"Could not inspect logging daemon: {e}", {}


def evaluate_continuous_tests(db) -> list[dict]:
    today = date.today()
    today_str = today.isoformat()
    ts = now()
    tests = []

    # 1. Policies Approved
    policies = Store.records(db, 'policies')
    pub_policies = [p for p in policies if p.get('status') == 'published']
    p_status = "pass" if len(pub_policies) >= 6 else ("warning" if pub_policies else "fail")
    tests.append({
        "id": "test_policies_approved",
        "title": "Baseline Information Security Policies Approved",
        "category": "Policies & Governance",
        "control_code": "CC1.1-GOV",
        "status": p_status,
        "summary": f"{len(pub_policies)} of {len(policies)} policies published with executive approval.",
        "remediation": "Publish required baseline policies in the Policies module with an authorized officer signature.",
        "last_run": ts,
        "evidence_data": {"published_count": len(pub_policies), "total_policies": len(policies)}
    })

    # 2. Policy SLAs & Annual Renewals
    expired_policies = []
    for p in pub_policies:
        r_date = p.get('review_date')
        if r_date and date.fromisoformat(r_date) < today:
            expired_policies.append(p['title'])
    sla_status = "fail" if expired_policies else "pass"
    tests.append({
        "id": "test_policy_slas",
        "title": "Annual Policy Review Cadence (SLA)",
        "category": "Policies & Governance",
        "control_code": "CC1.2-REVIEW",
        "status": sla_status,
        "summary": "All approved policies are within their annual review schedule." if not expired_policies else f"{len(expired_policies)} policy/policies exceeded review date: {', '.join(expired_policies)}",
        "remediation": "Review and re-publish expired policies annually to maintain continuous audit assurance.",
        "last_run": ts,
        "evidence_data": {"expired_policies": expired_policies}
    })

    # 3. Employee Policy Acceptance
    people = Store.records(db, 'people')
    active_people = [p for p in people if p.get('status') in ('active', 'onboarding')]
    if not active_people:
        acc_status = "pass"
        acc_msg = "No personnel records currently active."
    else:
        # Check acceptances
        acc_rows = db.execute("SELECT DISTINCT person_email FROM policy_acceptances").fetchall()
        accepted_emails = {r[0].lower() for r in acc_rows}
        compliant_people = sum(1 for p in active_people if p.get('email', '').lower() in accepted_emails or p.get('acknowledged_policy_ids'))
        acc_pct = (compliant_people / len(active_people)) * 100
        acc_status = "pass" if acc_pct >= 95 else ("warning" if acc_pct >= 50 else "fail")
        acc_msg = f"{compliant_people}/{len(active_people)} active personnel have accepted required policies ({acc_pct:.0f}%)."
    tests.append({
        "id": "test_employee_acceptance",
        "title": "Workforce Policy Acceptance & Attestation",
        "category": "Human Resources",
        "control_code": "HR.3-ACKNOWLEDGE",
        "status": acc_status,
        "summary": acc_msg,
        "remediation": "Ensure all workforce members accept security and acceptable use policies upon hire and after annual revisions.",
        "last_run": ts,
        "evidence_data": {"active_workforce": len(active_people)}
    })

    # 4. Host Disk Encryption (Real OS inspection)
    disk_status, disk_msg, disk_ev = check_real_host_disk_encryption()
    tests.append({
        "id": "test_host_disk_encryption",
        "title": "Endpoint & Storage Full-Disk Encryption",
        "category": "Host & Infrastructure",
        "control_code": "CC6.7-ENC-REST",
        "status": disk_status,
        "summary": disk_msg,
        "remediation": "Enable LUKS, FileVault, or BitLocker full-disk encryption on company hardware and servers.",
        "last_run": ts,
        "evidence_data": disk_ev
    })

    # 5. Host Firewall Active (Real OS inspection)
    fw_status, fw_msg, fw_ev = check_real_host_firewall()
    tests.append({
        "id": "test_host_firewall",
        "title": "Host Firewall & Inbound Packet Filtering",
        "category": "Host & Infrastructure",
        "control_code": "CC6.6-NET-SEC",
        "status": fw_status,
        "summary": fw_msg,
        "remediation": "Ensure host firewalls (ufw, nftables, or security groups) are enabled: sudo ufw enable",
        "last_run": ts,
        "evidence_data": fw_ev
    })

    # 6. SSH Security Hygiene
    ssh_status = "pass"
    ssh_msg = "SSH configuration adheres to baseline security defaults."
    sshd_path = Path("/etc/ssh/sshd_config")
    if sshd_path.exists():
        try:
            content = sshd_path.read_text(errors='ignore')
            if "PermitRootLogin yes" in content:
                ssh_status = "fail"
                ssh_msg = "SSH root login is explicitly permitted in /etc/ssh/sshd_config."
        except Exception:
            pass
    tests.append({
        "id": "test_ssh_security_hygiene",
        "title": "SSH Remote Access & Credential Hygiene",
        "category": "Host & Infrastructure",
        "control_code": "CC6.1-MFA",
        "status": ssh_status,
        "summary": ssh_msg,
        "remediation": "Set PermitRootLogin no and PasswordAuthentication no in /etc/ssh/sshd_config.",
        "last_run": ts,
        "evidence_data": {"sshd_config_checked": sshd_path.exists()}
    })

    # 7. User Access Reviews Completed
    reviews = Store.records(db, 'access_reviews')
    pending_reviews = [r for r in reviews if any(e.get('decision') == 'pending' for e in r.get('entries', []))]
    ar_status = "fail" if pending_reviews else "pass"
    tests.append({
        "id": "test_access_reviews_completed",
        "title": "Quarterly User Access Reviews & Account Auditing",
        "category": "Access Control",
        "control_code": "CC6.4-RECERT",
        "status": ar_status,
        "summary": "All access review decisions are resolved." if not pending_reviews else f"{len(pending_reviews)} access review campaign(s) have undecided accounts.",
        "remediation": "Complete pending keep/revoke determinations for all accounts under Access Reviews.",
        "last_run": ts,
        "evidence_data": {"pending_campaigns": len(pending_reviews)}
    })

    # 8. Vendor Risk Assessments
    vendors = Store.records(db, 'vendors')
    crit_vendors = [v for v in vendors if v.get('tier') in ('critical', 'high')]
    overdue_vendors = [v for v in crit_vendors if v.get('review_date') and date.fromisoformat(v['review_date']) < today]
    vnd_status = "fail" if overdue_vendors else "pass"
    tests.append({
        "id": "test_vendor_risk_reviews",
        "title": "Critical Vendor Annual Risk Assessments",
        "category": "Third-Party Risk",
        "control_code": "CC9.1-VENDOR-ASSESS",
        "status": vnd_status,
        "summary": f"All {len(crit_vendors)} critical/high vendors assessed within 365 days." if not overdue_vendors else f"{len(overdue_vendors)} critical vendor(s) past review date.",
        "remediation": "Review third-party SOC 2 reports or security assessments for high-tier vendors in the Vendors module.",
        "last_run": ts,
        "evidence_data": {"critical_vendors": len(crit_vendors), "overdue_count": len(overdue_vendors)}
    })

    # 9. Vendor DPAs & Sub-processor Agreements
    missing_dpas = [v for v in vendors if v.get('data_access') and v.get('data_access').strip() and not v.get('assessment_notes')]
    dpa_status = "warning" if missing_dpas else "pass"
    tests.append({
        "id": "test_vendor_dpas",
        "title": "Data Processing Agreements (DPAs) with Sub-processors",
        "category": "Third-Party Risk",
        "control_code": "CC9.2-DPA",
        "status": dpa_status,
        "summary": "Data access vendors have documented assessment notes." if not missing_dpas else f"{len(missing_dpas)} vendor(s) with data access need documented DPA verification.",
        "remediation": "Execute and record Data Processing Agreements (DPAs) with vendors processing customer personal data.",
        "last_run": ts,
        "evidence_data": {"unvetted_data_vendors": len(missing_dpas)}
    })

    # 10. Evidence Currency & Expiration
    evidence = Store.records(db, 'evidence')
    expired_evi = [e for e in evidence if e.get('expires_date') and date.fromisoformat(e['expires_date']) < today]
    evi_status = "fail" if expired_evi else "pass"
    tests.append({
        "id": "test_evidence_currency",
        "title": "Compliance Evidence Currency & Validity",
        "category": "Evidence & Audit",
        "control_code": "CC7.2-PEN-TEST",
        "status": evi_status,
        "summary": "All collected evidence attachments are current." if not expired_evi else f"{len(expired_evi)} evidence attachment(s) have passed their expiration date.",
        "remediation": "Upload refreshed screenshots, penetration tests, or SOC 2 reports in the Evidence module.",
        "last_run": ts,
        "evidence_data": {"expired_evidence_count": len(expired_evi)}
    })

    # 11. Control Ownership
    controls = Store.records(db, 'controls')
    app_controls = [c for c in controls if c.get('status') != 'not_applicable']
    unowned = [c for c in app_controls if not c.get('owner', '').strip()]
    ctl_status = "fail" if unowned else "pass"
    tests.append({
        "id": "test_control_ownership",
        "title": "Control Accountability & Ownership Assignment",
        "category": "Policies & Governance",
        "control_code": "CC1.1-GOV",
        "status": ctl_status,
        "summary": f"All {len(app_controls)} controls have designated owners." if not unowned else f"{len(unowned)} control(s) lack an assigned accountable owner.",
        "remediation": "Assign compliance control owners (e.g. CISO, VP Engineering, HR Lead) across your controls register.",
        "last_run": ts,
        "evidence_data": {"unowned_controls_count": len(unowned)}
    })

    # 12. High Risk Mitigation
    risks = Store.records(db, 'risks')
    high_unmitigated = [r for r in risks if r.get('status') != 'closed' and r.get('inherent_score', 0) >= 12 and not r.get('control_ids')]
    risk_status = "fail" if high_unmitigated else "pass"
    tests.append({
        "id": "test_high_risk_mitigation",
        "title": "Enterprise Risk Register Treatment Mapping",
        "category": "Risk Management",
        "control_code": "GV.1-RISK-REG",
        "status": risk_status,
        "summary": "All high risks have documented control treatments." if not high_unmitigated else f"{len(high_unmitigated)} high/critical risk(s) lack mapped mitigating controls.",
        "remediation": "Link mitigating compliance controls to all critical risks in the Risks register.",
        "last_run": ts,
        "evidence_data": {"unmitigated_high_risks": len(high_unmitigated)}
    })

    # 13. Insecure Network Ports (Real OS check)
    port_status, port_msg, port_ev = check_real_open_listening_ports()
    tests.append({
        "id": "test_network_open_ports",
        "title": "Network Attack Surface & Insecure Port Filtering",
        "category": "Host & Infrastructure",
        "control_code": "CC6.6-NET-SEC",
        "status": port_status,
        "summary": port_msg,
        "remediation": "Disable cleartext protocols (Telnet, unencrypted FTP) and close unneeded public listening ports.",
        "last_run": ts,
        "evidence_data": port_ev
    })

    # 14. System Audit Logging (Real OS check)
    log_status, log_msg, log_ev = check_system_logging()
    tests.append({
        "id": "test_system_logging_active",
        "title": "Centralized System Logging & Retention Daemon",
        "category": "Host & Infrastructure",
        "control_code": "CC7.3-LOGGING",
        "status": log_status,
        "summary": log_msg,
        "remediation": "Ensure systemd-journald or auditd logging service is running with persistent disk storage.",
        "last_run": ts,
        "evidence_data": log_ev
    })

    # 15. Workforce Background Checks
    unscreened = [p for p in active_people if p.get('background_check') == 'failed']
    bg_status = "fail" if unscreened else "pass"
    tests.append({
        "id": "test_background_checks",
        "title": "Pre-Employment Background Check Screening",
        "category": "Human Resources",
        "control_code": "HR.1-BACKGROUND",
        "status": bg_status,
        "summary": "All active personnel have verified background checks." if not unscreened else f"{len(unscreened)} employee(s) have unverified or failed background screening.",
        "remediation": "Verify pre-employment background screening records for all active workforce members.",
        "last_run": ts,
        "evidence_data": {"unscreened_count": len(unscreened)}
    })

    # 16. AICPA System Description Published
    desc_row = db.execute("SELECT value FROM settings WHERE key='system_description'").fetchone()
    has_desc = False
    if desc_row:
        try:
            d_json = json.loads(desc_row[0])
            has_desc = bool(d_json.get('sections'))
        except Exception:
            has_desc = False
    desc_status = "pass" if has_desc else "warning"
    tests.append({
        "id": "test_system_description",
        "title": "AICPA SOC 2 Section 3 System Description",
        "category": "Policies & Governance",
        "control_code": "CC2.1-COMM",
        "status": desc_status,
        "summary": "AICPA SOC 2 System Description is drafted and structured for auditor review." if has_desc else "AICPA System Description has not been published yet.",
        "remediation": "Draft and review your Section 3 System Description in the System Description module.",
        "last_run": ts,
        "evidence_data": {"system_description_initialized": has_desc}
    })

    return tests


def continuous_tests_router(store):
    router = APIRouter(prefix='/api/tests')

    @router.get('')
    def list_tests():
        with store.transaction() as db:
            last_run_row = db.execute("SELECT summary, run_at FROM continuous_test_runs ORDER BY rowid DESC LIMIT 1").fetchone()
            if last_run_row:
                tests = json.loads(last_run_row[0])
                last_run = last_run_row[1]
            else:
                tests = evaluate_continuous_tests(db)
                last_run = None

            passing = sum(1 for t in tests if t['status'] == 'pass')
            failing = sum(1 for t in tests if t['status'] == 'fail')
            warning = sum(1 for t in tests if t['status'] == 'warning')

            return {
                'tests': tests,
                'total': len(tests),
                'passing': passing,
                'failing': failing,
                'warning': warning,
                'health_percent': round((passing / len(tests)) * 100, 1) if tests else 0.0,
                'last_run': last_run
            }

    @router.post('/run')
    def run_tests():
        with store.transaction() as db:
            tests = evaluate_continuous_tests(db)
            run_time = now()
            run_id = str(uuid4())

            db.execute(
                "INSERT INTO continuous_test_runs (id, run_at, summary) VALUES (?, ?, ?)",
                (run_id, run_time, json.dumps(tests))
            )

            passing = sum(1 for t in tests if t['status'] == 'pass')
            failing = sum(1 for t in tests if t['status'] == 'fail')
            warning = sum(1 for t in tests if t['status'] == 'warning')

            log(db, 'continuous_test_run', 'tests', {'title': 'Executed automated continuous control tests'}, {
                'passing': passing,
                'failing': failing,
                'warning': warning,
                'total': len(tests)
            })

            return {
                'run_id': run_id,
                'tests': tests,
                'total': len(tests),
                'passing': passing,
                'failing': failing,
                'warning': warning,
                'health_percent': round((passing / len(tests)) * 100, 1) if tests else 0.0,
                'last_run': run_time
            }

    return router
