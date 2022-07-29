const TokenValidator = require('twilio-flex-token-validator').functionValidator;

let path = Runtime.getFunctions()['dialpad-utils'].path;
let assets = require(path);

const Response = (callback, xml) => {
    const response = new Twilio.Response();
    response.appendHeader('Content-Type', 'application/xml');
    response.setBody(xml.trim());
    response.appendHeader('Access-Control-Allow-Origin', '*');
    response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS POST GET');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
    callback(null, response);
    console.log('response: ', xml.trim());
  };

exports.handler = TokenValidator(async (context, event, callback) => {
    const {
        call_sid,
        ext_num
    } = event;

    console.log(`event is ${event}`);
    
    const client = context.getTwilioClient();

    const CallSid = event.call_sid;
    const ExtNum = event.ext_num;
    console.log('CallSid', CallSid);
    console.log('ExtNum', ExtNum);
    const twiml = `
        <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Dial>${ExtNum}</Dial>
            </Response>
        `.trim();
    console.log('twiml', twiml);
    await client.calls(CallSid).update({ twiml });
    //return Response(callback, twiml);    

    callback(null, assets.response("json", {status:"success"}));

});