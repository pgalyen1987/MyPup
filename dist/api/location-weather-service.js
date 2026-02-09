import { WeatherCodes } from './weather-utils.js';
export class LocationWeatherService {
    async getUserLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok)
                throw new Error('Failed to get location');
            const data = await response.json();
            return {
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country_name || 'Unknown',
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone || 'UTC'
            };
        }
        catch (error) {
            console.warn('Could not get location, using defaults:', error);
            return {
                city: 'Unknown',
                region: 'Unknown',
                country: 'Unknown',
                latitude: null,
                longitude: null,
                timezone: 'UTC'
            };
        }
    }
    async getTimeAndWeather(location) {
        const now = new Date();
        const options = { timeZone: location.timezone };
        const hour = this._getHour(now, options);
        const month = this._getMonth(now, options);
        const timeOfDay = this._getTimeOfDay(hour);
        const season = this._getSeason(month, location.latitude);
        const weatherReport = await this._fetchWeather(location);
        return {
            timeString: now.toLocaleString('en-US', { ...options, hour: 'numeric', minute: '2-digit', hour12: true }),
            timeOfDay,
            hour,
            season,
            weatherReport
        };
    }
    _getHour(date, options) {
        const hourStr = date.toLocaleString('en-US', { ...options, hour: 'numeric', hour12: false });
        return parseInt(hourStr) || 12;
    }
    _getMonth(date, options) {
        const monthStr = date.toLocaleString('en-US', { ...options, month: 'numeric' });
        return parseInt(monthStr) || 1;
    }
    _getTimeOfDay(hour) {
        if (hour >= 5 && hour < 12)
            return 'morning';
        if (hour >= 12 && hour < 17)
            return 'afternoon';
        if (hour >= 17 && hour < 20)
            return 'evening';
        return 'night';
    }
    _getSeason(month, latitude) {
        const isNorthern = (latitude || 0) >= 0;
        if (month >= 12 || month <= 2)
            return isNorthern ? 'winter' : 'summer';
        if (month >= 3 && month <= 5)
            return isNorthern ? 'spring' : 'fall';
        if (month >= 6 && month <= 8)
            return isNorthern ? 'summer' : 'winter';
        return isNorthern ? 'fall' : 'spring';
    }
    async _fetchWeather(location) {
        if (!location.latitude || !location.longitude) {
            return WeatherCodes.getDescription(0, 0);
        }
        try {
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=weather_code,precipitation&timezone=auto`;
            const response = await fetch(weatherUrl);
            if (response.ok) {
                const data = await response.json();
                return WeatherCodes.getDescription(data.current.weather_code, data.current.precipitation);
            }
        }
        catch (e) {
            console.warn('Could not fetch weather:', e);
        }
        return WeatherCodes.getDescription(0, 0);
    }
}
