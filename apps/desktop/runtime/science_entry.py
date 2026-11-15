"""Private JSON-only entry point for the preserved scientific engines."""
import json,sys
from routing.service import plan_request,json_default
from celestial.moons import moon_request
from science.voice_pack import extract_request

def main():
    operation=sys.argv[1] if len(sys.argv)==2 else ''
    try:
        request=json.load(sys.stdin)
        if operation=='routing.service':
            value=plan_request(request)
        elif operation=='science.voice_pack':
            value=extract_request(request)
        elif operation=='celestial.moons':
            value=moon_request(request.get('at'))
        else:
            raise ValueError('Unknown scientific operation')
        print(json.dumps(value,default=json_default,allow_nan=False))
    except (ValueError,TypeError,KeyError) as error:
        print(json.dumps({'status':'error','error':str(error)}))
        sys.exit(2)
if __name__=='__main__':
    main()
