var wsdlParser = require("wsdlrdr");
var soap = require('./soap');

var reg = /\%\%([a-zA-Z_]+)\(((?: *(["'`])((?:(?!\3)[a-zA-Z0-9_,. '"`])*)\3 *, *)*(?: *(["`'])((?:(?!\5)[a-zA-Z0-9_,. '"`])*)\5]* *))\)\%\%/g;

function sf_get(data, matches, arg){
	var body = soap.data.get_value
	.replace("{{USERNAME}}", process.env.username)
	.replace("{{PASSWORD}}", process.env.password)
	.replace("{{DATA_EXTENSION_NAME}}", arg[0])
	.replace("{{PROPERTY}}", arg[1])
	.replace("{{KEY}}", arg[2])
	.replace("{{FILTER_VALUE}}", arg[3]);

	return new Promise((resolve, reject) => {
		var error = false;
		soap.post_request(body).then(xml => {
			var response = wsdlParser.getXmlDataAsJson(xml).RetrieveResponseMsg;
			console.log('SOAP result', response);
			
			if(response.OverallStatus != 'OK')return reject({
				data: matches[0],
				error: response.OverallStatus
			});
			
			if(!response.Results)return reject({
				data: matches[0],
				error: 'Error: There are no rows with the property  ' + arg[2] + ' equals to ' + arg[3] + ' found in ' + arg[0]
			});


			var property  = response.Results.Properties.Property;
			data = data.replace(matches[0], property.Value);
			resolve(data);
		}).catch(err => {
			reject(err);
		})
	});
}

function make_args(d){
	var args = [];
	var arg;
	var reg = /(['"`])((?:(?!\1).)*)\1/g;
	while((arg = reg.exec(d)) != null)args.push(arg[2].trim());
	return args;
}



module.exports = function(data){
	reg.lastIndex = 0;
	var matches = [];
	var match;
	while((match = reg.exec(data)) != null)matches.push(match);
	var i = 0;


	function eject_f(){
		var f_name = matches[i][1];
		var arg = make_args(matches[i][2]);
		var f;
		switch(f_name){
			case 'get': f = sf_get; break;
		}
		return f(data, matches[i], arg).then(new_data => {
			data = new_data;
			i++;
			if(i == matches.length)return Promise.resolve(data);
			return eject_f();
		}).catch(err => {
			return Promise.reject(err);
		});
	}
	if(matches.length)return eject_f();
	return Promise.resolve(data);
}