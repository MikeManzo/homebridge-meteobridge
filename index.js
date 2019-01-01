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

var request = require("request");           // Async HTTP Requests
var syncRequest = require('sync-request');  // Sync HTTP Requests
var rp = require('request-promise');        // Promises Support
const moment = require('moment');           // Unix Tiime

var Service, Characteristic, FakeGatoHistoryService;
var temperatureService;
var humidityService;
var historyService;

/*
    Very important to export and expose our name and accessories!
*/
module.exports = function(homebridge) {
    Service = homebridge.hap.Service;

    // Homebridge Characteristics
    Characteristic = homebridge.hap.Characteristic;
    
    // History Service
    FakeGatoHistoryService = require('fakegato-history')(homebridge);

    // Register the whole thing ...
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
    
    For the Eve app, we need a couple of things:
        1. this.displayName <-- Without this, the loggins fails silently (start homebeidge in DEBUG mode to look for 'undefined' acccessory tagging)
        2. A simple callback to post the data to FakeGato
*/
function HomeMeteobridgeAccessory(log, config) {
    this.weather        = {};
    this.log            = log;
    this.name           = config["name"];
    this.ip             = config["ip_address"];
    this.freq           = config["frequency"];
    this.passoword      = config["password"];
    this.debug          = config["debug"]
    this.displayName    = config["name"];

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
    getStateHumidity: function(callback) {
        this.getState(function(w) {
            callback(null, w.humidity || 0);
        });
    },

    /*
        What is the state of the temperature accessory?
    */
   getStateTemperature: function(callback) {
        this.getState(function(w) {
            callback(null, w.temperature || 0);
        });
    },

    /*
        Add measurement to the history

        Since we only have 4 services and 2 are actually weather related, we are going to simplify this a bit.
        For the curious, check out [HAP-NodeJS-Types](https://github.com/mlaanderson/HAP-NodeJS-Types/tree/master/lib/gen) for the UUIDs of the sensors.
        As always - we have the opportunity for some debugging ... but the defualt is off.  Let it ride.
    */
    addToHistory: function() {
        var measuremenTime = moment().unix(); //new Date().getTime() / 1000;
        var temp, humidity;
        var that = this;

        for (var i = 0; i < this.services.length; i++) {
            switch (this.services[i].UUID) {
                case "0000008A-0000-1000-8000-0026BB765291":    // Temperature Service (Sensor)
                    temp = this.services[i].getCharacteristic(Characteristic.CurrentTemperature).value;
                break;
                case "00000082-0000-1000-8000-0026BB765291":    // Humidity Service (Sensor)
                    humidity = this.services[i].getCharacteristic(Characteristic.CurrentRelativeHumidity).value;
                break;
                case "0000003E-0000-1000-8000-0026BB765291":    // Accessory Information
                    // Ignore
                break;
                case "E863F007-079E-48FF-8F27-9C2605A29F52":    // FakeGatoHistoryService
                    // Ignore
                break;
                default:
                    that.log.error("UUID Slipped through")
                    temp = humidity = 0;
                break;
            }
        }
        if (that.debug == 'true') {
            that.log.info("Saving weatherstation history for Temperature: %s, & Humidity: %s @ time %s", temp, humidity, measuremenTime);
        }

        that.historyService.addEntry( {
            time: measuremenTime,
            temp: temp,
            pressure: 0,
            humidity: humidity
        });

        // Call function every 9:50 minutes (a new entry every 10 minutes is required to avoid gaps in the graph)
        setTimeout(this.addToHistory.bind(this), (10 * 60 * 1000) - 10000);
    },

    /*
        The heart of the matter.  Refer to the following for template generation for temp and humidy:
            1. https://www.meteobridge.com/wiki/index.php/Templates
            2. https://www.meteobridge.com/wiki/index.php/Add-On_Services

        We will need to build the appropriate request for our data: 
            1. http://your.unique.station.ip/cgi-bin/template.cgi?template=[th0temp-act=.1:---],[th0hum-act:---]
            2. Data is returned as follows:
                data[0]: Temperature
                data[1]: Humidity
                data[2]: Battery Health (1 is low battery)

        Once we check for validity, we simply convert our data and format our weather object accordingly .. then call the callback.
        NOTE: We will need to pass the user credentials for your meteobridge with your request.  Remember:
            username: meteobridge
            password: <default> meteobridge <-- You had better have changed THIS!

        Fault Codes:
            0 - No Fault
            1 - Meteobridge returned NaN (Not a Number) ... retry
            2 - Meteobridge is just not responding; check the comsole log for the error and statusCode 
    */
    getState: function (callback) {
        var that = this

        request("http://" + "meteobridge:" + this.passoword + "@" + that.ip + "/cgi-bin/template.cgi?template=[th0temp-act=.1:---],[th0hum-act:---],[th0lowbat-act:---]", (error, response, body) => {
            if (!error && response.statusCode == 200) {
                var data = body.split(',');
                if (!isNaN(data[0]) && !isNaN(data[1])) {
                    that.weather.temperature    = parseFloat(data[0]);
                    that.weather.humidity       = parseFloat(data[1]);

                    that.humidityService.setCharacteristic(Characteristic.StatusActive, 1);
                    that.humidityService.setCharacteristic(Characteristic.StatusLowBattery, parseInt(data[2]));
                    that.humidityService.setCharacteristic(Characteristic.StatusFault, 0);

                    that.temperatureService.setCharacteristic(Characteristic.StatusActive, 1);
                    that.temperatureService.setCharacteristic(Characteristic.StatusLowBattery, parseInt(data[2]));
                    that.temperatureService.setCharacteristic(Characteristic.StatusFault, 0);
                } else {
                    that.log.info("Did not recieve valid data; setting values to zero & faulting.  Will try again in " + this.freq/1000 + " seconds.");
                    that.weather.temperature = 0;
                    that.weather.humidity    = 0;

                    that.temperatureService.setCharacteristic(Characteristic.StatusFault, 1);
                    that.temperatureService.setCharacteristic(Characteristic.StatusActive, 0);

                    that.humidityService.setCharacteristic(Characteristic.StatusFault, 1);
                    that.humidityService.setCharacteristic(Characteristic.StatusActive, 0);
                }
            } else {
                that.log.error("Error retrieving temperature & humidity data from: " + that.ip + " because of error: " + error + " with a response code of: " + response.statusCode);
                that.temperatureService.setCharacteristic(Characteristic.StatusFault, 2);
                that.temperatureService.setCharacteristic(Characteristic.StatusActive, 0);

                that.humidityService.setCharacteristic(Characteristic.StatusFault, 2);
                that.humidityService.setCharacteristic(Characteristic.StatusActive, 0);
            }
            callback(that.weather);
        });
    },

    identify: function (callback) {
        this.log("My identify has been requested - so send it!");
        callback();
    },

    /*
        Set up the services we are going to expose.  Very simple ... Temperature and humidity for us.
            Note (1):   I chose to use "sync-request" because I wanted the getServices fucntion to block until we recieved thespecificzations
                        from the Meteobridge.  I could not figure out a way to do it in the completion block of the async request call (I even tried promises).
                        If someone can show me a way to accomplish this w/o a bnlocing call, I will use it.  For now, this function gets called once.  We can 
                        block until it returns.
            Note (2):   Here is the promise block I would have liked to have used
                            rp("http://" + "meteobridge:" + this.passoword + "@" + this.ip + "/cgi-bin/template.cgi?template=[mbsystem-mac],[mbsystem-platform],[mbsystem-swversion]")
                                .then(function (result) {
                                    var data = result.split(',');
                                    serialNum = data[0];
                                    model = data[1];
                                    swVersion = data[2];
                                    that.log.info("Specifications --> Serial Number: " + serialNum + "   Model: " + model + "   Version: " + swVersion);

                                })
                                .catch(function (err) {
                                    that.log.error("*** Error ***: " + err);
                                    that.log.info("*** Warning ***: Unable to determine MAC address, Platform or Firmware version; defaults are being used.");
                            });
            Note (3):   Added support fot fault and active notifications; I don't see that I can trigger off of the active vs. inactive ... but it's cool to see the 
                        status in the app when it changes.
    */
    getServices: function () {
        var serialNum = "Unknown"
        var model = "Unknown"
        var swVersion = 0.0

        var informationService = new Service.AccessoryInformation();
        //var services = []
        this.services = [];
        var that = this;

        var myURL = "http://" + "meteobridge:" + this.passoword + "@" + this.ip + "/cgi-bin/template.cgi?template=[mbsystem-mac],[mbsystem-platform],[mbsystem-swversion]";
        var result = syncRequest('GET', myURL);
        if (result.statusCode == 200) {
            var body = result.getBody().toString();
            var data = body.split(',');
            serialNum = data[0];
            model = data[1];
            swVersion = data[2];
        } else {
            that.log.error("*** Error ***: " + result.statusCode);
            that.log.info("*** Warning ***: Unable to determine Meteobridge specifics; defaults are being used.");
        }

        that.log.info("Specifications --> Serial Number: " + serialNum + "   Model: " + model + "   Version: " + swVersion);
        informationService
            .setCharacteristic(Characteristic.Manufacturer, "smartbedded GmbH")
            .setCharacteristic(Characteristic.Model, "Platform Type: " + model)
            .setCharacteristic(Characteristic.SerialNumber, serialNum)
            .setCharacteristic(Characteristic.FirmwareRevision, "Meteobridge: " + swVersion)
            .setCharacteristic(Characteristic.Name, "Meteobridge")
        
        informationService.addCharacteristic(Characteristic.StatusActive);
        informationService.addCharacteristic(Characteristic.StatusFault);
        this.services.push(informationService); // Add informationService to the array of services we are going to return

        this.temperatureService = new Service.TemperatureSensor("Temperature"); 
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

        this.temperatureService.addCharacteristic(Characteristic.StatusActive);    
        this.temperatureService.addCharacteristic(Characteristic.StatusFault);    
        this.temperatureService.addCharacteristic(Characteristic.StatusLowBattery);
 		this.services.push(this.temperatureService); // Add temperatureService to the array of services (sensors, really) we are going to return

        this.humidityService = new Service.HumiditySensor("Humidity");
        this.humidityService
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('get', this.getStateHumidity.bind(this));
        
        this.humidityService.addCharacteristic(Characteristic.StatusActive);
        this.humidityService.addCharacteristic(Characteristic.StatusFault);
        this.humidityService.addCharacteristic(Characteristic.StatusLowBattery);
        this.services.push(this.humidityService);    // Add humidityService to the array of services (sensors) we are going to return
 
        // Lert's create the history service for Elgato
        this.historyService = new FakeGatoHistoryService("weather", this, {
            storage: 'fs'
        });
        setTimeout(this.addToHistory.bind(this), 10000);
        this.services.push(this.historyService);    // Add historyService to the array of services (sensors) we are going to return

        return this.services; 
    }
};