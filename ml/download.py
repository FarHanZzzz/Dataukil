"""Download only required artifacts and record the exact upstream revision."""
import json
from pathlib import Path
from huggingface_hub import HfApi,snapshot_download

def main():
    root=Path(__file__).resolve().parents[1]
    repo='intfloat/multilingual-e5-small'
    revision=HfApi().model_info(repo).sha
    print('Downloading',repo,revision,flush=True)
    snapshot_download(repo_id=repo,revision=revision,local_dir=root/'models'/'encoder',
        allow_patterns=['config.json','model.safetensors','tokenizer*','sentencepiece.bpe.model','special_tokens_map.json','README.md'])
    (root/'models'/'encoder_source.json').write_text(json.dumps(dict(repo=repo,revision=revision,license='MIT',encoder_frozen=True),indent=2),encoding='utf-8')
    print('Encoder download complete.',flush=True)

if __name__=='__main__':main()
