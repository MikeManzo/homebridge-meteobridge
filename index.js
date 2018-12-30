/*
Copyright 2018, Mike Manzo

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), 
to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var request = require("request");
var Service, Characteristic;

var temperatureService;
var humidityService;

/*
Very important to export and expose our name and accessories!
*/
module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    
    homebridge.registerAccessory("homebridge-meteobridge", "HomeMeteobridge", HomeMeteobridgeAccessory);
};

/*
Set up the accessory with the IP of the Meteobridge, the admin password, and the frequency you wish to update the sensors.
Currently the limit is set to once every 5 seconds.

We are going to be looking for the following:
    "accessories": [
        {
            "accessory": "HomeMeteobridge",     <-- Our Accessory name
            "name": "Meteobridge",              <-- Easy to remember name
            "ip_address":  "A.B.C.D",           <-- IP address of our meteobridge
            "frequency": 5000,                  <-- Update frequency (5 second min)
            "password": "<password>",           <-- Admin password for Meteobridge
            "debug": "true"                     <-- Display temp/humidity readings in teh console
        }
    ]
*/
function HomeMeteobridgeAccessory(log, config) {
    this.weather    = {};
    this.log        = log;
    this.name       = config["name"];
    this.ip         = config["ip_address"];
    this.freq       = config["frequency"];
    this.passoword  = config["password"];
    this.debug      = config["debug"]

    if (this.freq < 5000) {
        this.log.info("Warning: Minimum polling of Meteobridge is currently set to 5 seconds.");
        freq = 5000;
    }

    this.weather.temperature = 0.0
    this.weather.humidity    = 0.0

    var that = this;
    setTimeout(function() {
        that.servicePolling();
    }, this.freq);
}

/*
servicePolling: This is the callback function for the getState method
*/
HomeMeteobridgeAccessory.prototype = {
    servicePolling: function() {      
		this.getState(function(measurement) {
			var that = this;
        
            if (that.debug == 'true') {
                that.log.info("Weatherstation Temperature is: %s, Humidity is: %s", measurement.temperature, measurement.humidity);
            }

			that.temperatureService.setCharacteristic(Characteristic.CurrentTemperature, measurement.temperature || 0);
			that.humidityService.setCharacteristic(Characteristic.CurrentRelativeHumidity, measurement.humidity || 0);
        
            setTimeout(function() {
				that.servicePolling();
            }, that.freq);
            
		}.bind(this));
	},

    /*
    What is the state of the humidity accessory?
    */
    getStateHumidity: function(callback){
        this.getState(function(w) {
            callback(null, w.humidity || 0);
        });
    },

    /*
    What is the state of the temperature accessory?
    */
   getStateTemperature: function(callback){
        this.getState(function(w) {
            callback(null, w.temperature || 0);
        });
    },

    /*
    The heart of the matter.  Refer to the following for template generation for temp and humidy:
        1. https://www.meteobridge.com/wiki/index.php/Templates
        2. https://www.meteobridge.com/wiki/index.php/Add-On_Services

    We will need to build the appropriate request for our data: 
        1. http://your.unique.station.ip/cgi-bin/template.cgi?template=[th0temp-act=.1:---],[th0hum-act:---]

    Once we check for validity, we simply convert our data and format our weather object accordingly .. then call the callback.
    NOTE: We will need to pass the user credentials for your meteobridge with your request.  Remember:
        username: meteobridge
        password: <default> meteobridge <-- You had better have changed THIS!
    */
    getState: function (callback) {
        var that = this

        request("http://" + "meteobridge:" + this.passoword + "@" + that.ip + "/cgi-bin/template.cgi?template=[th0temp-act=.1:---],[th0hum-act:---]", (error, response, body) => {
            if (!error && response.statusCode == 200) {
                var data = body.split(',');
                if (!isNaN(data[0]) && !isNaN(data[1])) {
                    that.weather.temperature    = parseFloat(data[0]);
                    that.weather.humidity       = parseFloat(data[1]);
                    that.temperatureService.setCharacteristic(Characteristic.StatusFault, 0);
                    that.humidityService.setCharacteristic(Characteristic.StatusFault, 0);
                } else {
                    that.weather.temperature    = 0;
                    that.weather.humidity       = 0;
                    that.temperatureService.setCharacteristic(Characteristic.StatusFault, 1);
                    that.humidityService.setCharacteristic(Characteristic.StatusFault, 1);
                }
            } else {
                that.log.info("Error retrieving temperature & humidity data from: " + that.ip);
                that.temperatureService.setCharacteristic(Characteristic.StatusFault, 1);
                that.humidityService.setCharacteristic(Characteristic.StatusFault, 1);
            }
        });

        callback(that.weather);
    },

    identify: function (callback) {
        this.log("Identify requested!");
        callback(); // success
    },

    /*
    Set up the services we are going to expose.  Very simple ... Temperature and humidity for us.
    */
    getServices: function () {
        var services = []
        var informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, "HomeBridge")
            .setCharacteristic(Characteristic.Model, "Meteobridge")
  		services.push(informationService);

        this.temperatureService = new Service.TemperatureSensor(this.name + " Temperature"); // Sensor will display "Meteobridge Temperature" 
        this.temperatureService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getStateTemperature.bind(this));

        // Let's set a minimum temperature of -20
        this.temperatureService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({minValue: -20});

        // Let's set a maximum temperature of 120
        this.temperatureService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({maxValue: 120});
		services.push(this.temperatureService);

        this.humidityService = new Service.HumiditySensor(this.name + " Humidity"); // Sensor will display "Meteobridge Humidity"
        this.humidityService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getStateHumidity.bind(this));
		services.push(this.humidityService);

        return services;
    }
};