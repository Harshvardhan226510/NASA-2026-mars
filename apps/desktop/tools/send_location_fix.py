"""Send an already resolved Mars position to a local Atlas app; no extra packages."""
import argparse
import json
import os
from datetime import datetime, timezone
from urllib.request import Request, build_opener, ProxyHandler

def send_fix(point, source_id='eva-nav-1', accuracy_meters=None):
    port=int(os.environ['MARS_ATLAS_DR_PORT'])
    if not 1 <= port <= 65535:
        raise ValueError('Invalid local API port')
    token=os.environ['MARS_ATLAS_DR_TOKEN']
    payload={'sourceId':source_id,'frame':'mars-east-planetocentric','point':point,
             'at':datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),
             'accuracyMeters':accuracy_meters}
    request=Request(f'http://127.0.0.1:{port}/v1/location/fixes',data=json.dumps(payload,allow_nan=False).encode(),
                    headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'},method='POST')
    with build_opener(ProxyHandler({})).open(request,timeout=10) as response:
        return json.load(response)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lon',type=float,required=True)
    parser.add_argument('--lat',type=float,required=True)
    parser.add_argument('--source',default='eva-nav-1')
    parser.add_argument('--accuracy',type=float)
    args=parser.parse_args()
    print(json.dumps(send_fix([args.lon,args.lat],args.source,args.accuracy)))
