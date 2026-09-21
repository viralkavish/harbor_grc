from pathlib import Path
import re


def test_deployment_template_does_not_embed_live_api_credentials():
    template = (Path(__file__).resolve().parents[2] / 'deployment/harbor-grc.service').read_text()
    contains_credential = bool(re.search(r'apikey_[A-Za-z0-9_]{30,}', template))
    assert not contains_credential, 'Deployment template contains a live-shaped API credential'
