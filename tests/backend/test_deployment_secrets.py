from pathlib import Path
import re


def test_deployment_template_does_not_embed_live_api_credentials():
    deployment_dir = Path(__file__).resolve().parents[2] / 'deployment'
    if not deployment_dir.exists():
        return
    for template_file in deployment_dir.glob('*'):
        if template_file.is_file():
            content = template_file.read_text()
            contains_credential = bool(re.search(r'apikey_[A-Za-z0-9_]{30,}', content))
            assert not contains_credential, f'{template_file.name} contains a live-shaped API credential'
