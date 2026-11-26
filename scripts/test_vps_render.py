import urllib.request
import json
import time
from PIL import Image

# Build a simple scene
scene = {
    "version": "1.0",
    "renderSettings": {
        "resolution": [960, 540],
        "samples": 8
    },
    "lighting": {
        "daylightPercent": 30,
        "interiorFillWatts": 20,
        "exposureEV": 0.0
    },
    "camera": {
        "position": [0, -4.0, 1.8],
        "target": [0, 0, 0.9],
        "fov": 50
    },
    "materials": {
        "wall_mat": {
            "name": "WallPaint",
            "baseColor": [0.9, 0.9, 0.9],
            "roughness": 0.5
        },
        "cab_mat": {
            "name": "CabinetOak",
            "baseColor": [0.8, 0.6, 0.3],
            "roughness": 0.3
        }
    },
    "objects": [
        {
            "name": "Floor",
            "role": "floor",
            "material": "wall_mat",
            "vertices": [[-3, -3, 0], [3, -3, 0], [3, 3, 0], [-3, 3, 0]],
            "faces": [[0, 1, 2], [0, 2, 3]]
        },
        {
            "name": "Cabinet",
            "role": "box",
            "material": "cab_mat",
            "vertices": [
                [-1, -0.5, 0], [1, -0.5, 0], [1, 0.5, 0], [-1, 0.5, 0],
                [-1, -0.5, 1], [1, -0.5, 1], [1, 0.5, 1], [-1, 0.5, 1]
            ],
            "faces": [
                [0, 1, 5], [0, 5, 4],
                [1, 2, 6], [1, 6, 5],
                [2, 3, 7], [2, 7, 6],
                [3, 0, 4], [3, 4, 7],
                [4, 5, 6], [4, 6, 7]
            ]
        }
    ]
}

payload = {
    "cyclesData": scene,
    "preset": "preview",
    "projectId": "diag_test"
}

data_bytes = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(
    'https://studio.orbixdesigns.com/api/render/jobs',
    data=data_bytes,
    headers={'Content-Type': 'application/json'}
)

print("Submitting diagnostic job...")
with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode('utf-8'))

job_id = res['job']['id']
print(f"Job ID: {job_id}")

while True:
    time.sleep(2)
    s_req = urllib.request.Request(f'https://studio.orbixdesigns.com/api/render/jobs/{job_id}')
    with urllib.request.urlopen(s_req) as s_resp:
        j = json.loads(s_resp.read().decode('utf-8'))['job']
    status = j.get('status')
    stage = j.get('progress', {}).get('stage')
    pct = j.get('progress', {}).get('percent')
    print(f"[{status}] {pct}% - {stage}")
    if status in ['completed', 'failed']:
        if status == 'completed':
            out_url = 'https://studio.orbixdesigns.com' + j.get('outputUrl')
            print("Downloading:", out_url)
            urllib.request.urlretrieve(out_url, 'vps_diag_result.png')
            img = Image.open('vps_diag_result.png')
            print("Extrema:", img.getextrema())
        else:
            print("Job Error:", j.get('error'))
        break
