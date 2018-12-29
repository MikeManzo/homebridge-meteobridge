var request = require("request");
var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    
    homebridge.registerAccessory("homebridge-meteobridge", "HomeMeteobridge", HomeMeteobridgeAccessory);
};

function HomeMeteobridgeAccessory(log, config) {
    this.log = log;
    this.name = config["name"];
    this.url = config["url"];
    this.type = config["type"] || "page";
    this.json_url = config["json_url"] || null;
    this.temp_url = config["temp"];
    this.humi_url = config["humidity"];
    this.wind_url = config["wind"];
    this.freq = config["freq"] || 1000;

    this.temperature = 0;
    this.humidity = 0;
    this.wind = 0;

    this.services = [];

    // Temperature
    this.temperatureService = new Service.TemperatureSensor ("Temperature Sensor");
    this.temperatureService
    .getCharacteristic(Characteristic.CurrentTemperature)
    .on('get', this.getValue.bind(this, 'temperature'));
    this.services.push(this.temperatureService);    
    
    // Humidity
    this.humidityService = new Service.HumiditySensor ("Humidity Sensor");
    this.humidityService
    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
    .on('get', this.getValue.bind(this, 'humidity'));
    this.services.push(this.humidityService);

    // Wind
    this.windService = new Service.WindSensor  ("Wind Sensor");
    this.windService
    .getCharacteristic(Characteristic.CurrentWindSpeed)
    .on('get', this.getValue.bind(this, 'wind'));
    this.services.push(this.windService);

    setInterval(() => {
        this.getValue(null, (err, { humidity, temperature, wind}) => {

        this.temperatureService
        .setCharacteristic(Characteristic.CurrentTemperature, temperature);

        this.humidityService
        .setCharacteristic(Characteristic.CurrentRelativeHumidity, humidity);

        this.windService
        .setCharacteristic(Characteristic.CurrentWindSpeed, wind);
        });}, this.freq);
}

HomeMeteobridgeAccessory.prototype.getValue = function(name, callback) {
    if(type == "page"){
        // http://10.0.0.137/cgi-bin/template.cgi?template=[th0temp-act=F.1:---]
        request(this.url + "/cgi-bin/template.cgi?template=[th0temp-act=F.1:---]", (error, response, body) => {
            if (!error && response.statusCode == 200) {
                var temperature = parseInt(body, 10);
                if(name == "temperature"){
                    return callback(null, temperature);
                }
                else{ // http://10.0.0.137/cgi-bin/template.cgi?template=[th0hum-act:---]
                    request(this.url + "/cgi-bin/template.cgi?template=[th0hum-act:---]", (error, response, body) => {
                        if (!error && response.statusCode == 200) {
                            var humidity = parseInt(body, 10);
                            if(name == "humidity"){
                                return callback(null, humidity);
                            }
                            else{ // http://10.0.0.137/cgi-bin/template.cgi?template=[wind0wind-act:---]
                                request(this.url + "/cgi-bin/template.cgi?template=[wind0wind-act:---]", (error, response, body) => {
                                    if (!error && response.statusCode == 200) {
                                        var light = parseInt(body, 10);
                                        if(name == "wind"){
                                            return callback(null, light);
                                        }
                                        else{
                                            return callback(null, { humidity: humidity, temperature: temperature, light: light });
                                        } //End: else, name != "humidity"
                                    } //End: if OK respone
                                }); //End: request light
                            } //End: else, name != "humidity"
                        } //End: if OK respone
                    }); //End: request humidity
                } //End: else, name != "temperature"
            } //End: if OK respone
        }); //End: request temperature
    } else {
        request(this.url + this.json_url, (error, response, body) => {
            if (!error && response.statusCode == 200) {
                var obj = JSON.parse(body);
                return callback(null, { humidity: obj.humidity, temperature: obj.temperature, wind: obj.wind });
            } 
        });
    }
};

HomeMeteoAccessory.prototype.getServices = function() {
    return this.services;
};