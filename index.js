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
var inherits = require('util').inherits;    // Inheritance Support
const moment = require('moment');           // Unix Tiime

var Service, Characteristic, FakeGatoHistoryService;

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

    this.weather.temperature    = 0.0;
    this.weather.humidity       = 0.0;
    this.weather.airpresssure   = 0.0;
    this.weather.uv             = 0.0;
    this.weather.windspeed      = 0.0;

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
                that.log.info("Weatherstation Temperature is: %s // Humidity is: %s // Pressue is: %s // UV Index is: %s // Wind Speed: %s", 
                               measurement.temperature, measurement.humidity,
                               measurement.airpresssure, measurement.uv,
                               measurement.windspeed);
            }

			that.temperatureService.setCharacteristic(Characteristic.CurrentTemperature, measurement.temperature || 0);
            that.humidityService.setCharacteristic(Characteristic.CurrentRelativeHumidity, measurement.humidity || 0);

            that.weatherSensorService.setCharacteristic(AirPressure, measurement.airpresssure || 0.0);
            that.weatherSensorService.setCharacteristic(WindSpeed, measurement.windspeed || 0.0);
            that.weatherSensorService.setCharacteristic(UVSensor, measurement.uv || 0);
        
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
            callback(null, w.temperature || 0.0);
        });
    },

    /*
        What is the state of the Air Pressure accessory?
    */
    getCurrentAirPressure: function(callback) {
        this.getState(function(w) {
            callback(null, w.airpresssure || 0.0);
        });
    },

    /*
        What is the state of the UV accessory?
    */
   getCurrentUV: function(callback) {
        this.getState(function(w) {
            callback(null, w.uv || 0.0);
        });
    },

    /*
        What is the state of the UV accessory?
    */
   getCurrentWindSpeed: function(callback) {
       this.getState(function(w) {
        callback(null, w.windspeed || 0.0);
        });
    },

    /*
        Add measurement to the history

        Since we only have 4 services and 2 are actually weather related, we are going to simplify this a bit.
        For the curious, check out [HAP-NodeJS-Types](https://github.com/mlaanderson/HAP-NodeJS-Types/tree/master/lib/gen) for the UUIDs of the sensors.
        As always - we have the opportunity for some debugging ... but the defualt is off.  Let it ride.
    */
    addToHistory: function() {
        var measuremenTime = moment().unix();
        var temp, humidity, pressure;
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
                case "91c9e63b-4319-4983-92bd-604ca8ce2063":    // WeatherSensorService
                    pressure = this.services[i].getCharacteristic(AirPressure).value;
                break;
                default:
                    that.log.error("Undefined UUID for Eve detected: [%s] - Ignoring.", this.services[i].UUID);
                break;
            }
        }
        if (that.debug == 'true') {
            that.log.info("Saving weatherstation history for Temperature: %s, Humidity: %s, Pressure: %s @ time %s", temp, humidity, pressure, measuremenTime);
        }

        that.historyService.addEntry( {
            time: measuremenTime,
            temp: temp,
            pressure: pressure,
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
                data[2]: Pressure
                data[3]: UV
                data[4]: Wind Speed
                data[5]: Battery Health (1 is low battery)

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

        request("http://" + "meteobridge:" + this.passoword + "@" + that.ip + "/cgi-bin/template.cgi?template=[th0temp-act=.1:---],[th0hum-act:---],[thb0press-act:---],[uv0index-act:---],[wind0wind-act:---],[th0lowbat-act:---]",
                                                                                (error, response, body) => {
            if (!error && response.statusCode == 200) {
                var data = body.split(',');
                if (!isNaN(data[0]) && !isNaN(data[1])) {
                    that.weather.temperature    = parseFloat(data[0]);  // Temp
                    that.weather.humidity       = parseFloat(data[1]);  // Humidity
                    that.weather.airpresssure   = parseFloat(data[2]);  // Pressure
                    that.weather.uv             = parseFloat(data[3]);  // Ultra Violet Index
                    that.weather.windspeed      = parseFloat(data[4]);  // Wind Speed


                    that.humidityService.setCharacteristic(Characteristic.StatusActive, 1);
                    that.humidityService.setCharacteristic(Characteristic.StatusLowBattery, parseInt(data[5]));
                    that.humidityService.setCharacteristic(Characteristic.StatusFault, 0);

                    that.temperatureService.setCharacteristic(Characteristic.StatusActive, 1);
                    that.temperatureService.setCharacteristic(Characteristic.StatusLowBattery, parseInt(data[5]));
                    that.temperatureService.setCharacteristic(Characteristic.StatusFault, 0);
                } else {
                    that.log.info("Did not recieve valid data from the Meteobridge; keeping previous values & faulting.  Next attempt in " + this.freq/1000 + " seconds.");

                    that.temperatureService.setCharacteristic(Characteristic.StatusFault, 1);
                    that.temperatureService.setCharacteristic(Characteristic.StatusActive, 0);

                    that.humidityService.setCharacteristic(Characteristic.StatusFault, 1);
                    that.humidityService.setCharacteristic(Characteristic.StatusActive, 0);
                }
            } else {
                that.log.error("Error retrieving station data from: " + that.ip + " because of error: " + error + " with a response code of: " + response.statusCode);
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
    
        // Custom Airpressure Characteristic
        AirPressure = function () {
            Characteristic.call(this, 'Air Pressure', '7e4d6810-5dd3-45ea-a24f-7190f883e2f6');
            this.setProps({
                format: Characteristic.Formats.FLOAT,
                unit: "hPa",
                maxValue: 1200,
                minValue: 600,
                minStep: 0.1,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        inherits(AirPressure, Characteristic);
        AirPressure.UUID = '7e4d6810-5dd3-45ea-a24f-7190f883e2f6';

        // Custom Windspeed Characteristic
        WindSpeed = function () {
            Characteristic.call(this, 'Wind Speed', '2566e99c-f091-48d9-b977-f93d69264deb');
            this.setProps({
                format: Characteristic.Formats.FLOAT,
                unit: "m/s",
                maxValue: 1000,
                minValue: 0,
                minStep: 0.1,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        inherits(WindSpeed, Characteristic);
        AirPressure.UUID = '2566e99c-f091-48d9-b977-f93d69264deb';

        // Custom UV Characteristic
        UVSensor = function () {
            Characteristic.call(this, 'UV Index', '5e1d5b4e-8320-4ffe-8fc6-00591bf24bf7');
            this.setProps({
                format: Characteristic.Formats.UINT8,
                maxValue: 10,
                minValue: 0,
                minStep: 1,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        inherits(UVSensor, Characteristic);
        UVSensor.UUID = '5e1d5b4e-8320-4ffe-8fc6-00591bf24bf7';

        // Custom Weather Sensor
        WeatherSensor = function (displayName, subtype) {
            Service.call(this, displayName, '91c9e63b-4319-4983-92bd-604ca8ce2063', subtype);

            // Required Characteristic(s)
            this.addCharacteristic(AirPressure);
            this.addCharacteristic(UVSensor);
            this.addCharacteristic(WindSpeed);

            // Optional ....
        };
        inherits(WeatherSensor, Service);
        WeatherSensor.UUID = '91c9e63b-4319-4983-92bd-604ca8ce2063';

        this.weatherSensorService = new WeatherSensor('WeatherSensor');
        this.weatherSensorService
            .getCharacteristic(AirPressure)
            .on('get', this.getCurrentAirPressure.bind(this));

        this.weatherSensorService
            .getCharacteristic(UVSensor)
            .on('get', this.getCurrentUV.bind(this));

        this.weatherSensorService
            .getCharacteristic(WindSpeed)
            .on('get', this.getCurrentWindSpeed.bind(this));

        this.services.push(this.weatherSensorService);  // Add WeatherSensorService to the array of services we are going to return

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