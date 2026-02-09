export const WeatherCodes = {
    getDescription(code, precipitation) {
        const report = {
            description: 'clear sky',
            hasPrecipitation: precipitation > 0,
            precipitationType: 'none',
            weatherCode: code
        };
        if (code === 0) {
            report.description = 'clear sky';
        }
        else if (code <= 3) {
            report.description = 'partly cloudy';
        }
        else if (code >= 51 && code <= 67) {
            report.description = 'rainy';
            report.precipitationType = 'rain';
            report.hasPrecipitation = true;
        }
        else if (code >= 71 && code <= 77) {
            report.description = 'snowy';
            report.precipitationType = 'snow';
            report.hasPrecipitation = true;
        }
        else if (code >= 80 && code <= 82) {
            report.description = 'rain showers';
            report.precipitationType = 'rain';
            report.hasPrecipitation = true;
        }
        else if (code >= 85 && code <= 86) {
            report.description = 'snow showers';
            report.precipitationType = 'snow';
            report.hasPrecipitation = true;
        }
        else if (code >= 95) {
            report.description = 'stormy';
            report.precipitationType = 'rain';
            report.hasPrecipitation = true;
        }
        else {
            report.description = 'cloudy';
        }
        return report;
    },
};
