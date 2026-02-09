/**
 * location-weather-service.ts - Location and weather data fetching
 */

import { LocationData, TimeWeather } from './types.js';
import { WeatherCodes } from './weather-utils.js';

export class LocationWeatherService {
    async getUserLocation(): Promise<LocationData> {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) throw new Error('Failed to get location');
            const data = await response.json();
            return {
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country_name || 'Unknown',
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone || 'UTC'
            };
        } catch (error) {
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

    async getTimeAndWeather(location: LocationData): Promise<TimeWeather> {
        const now = new Date();
        const options: Intl.DateTimeFormatOptions = { timeZone: location.timezone };

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

    private _getHour(date: Date, options: Intl.DateTimeFormatOptions): number {
        const hourStr = date.toLocaleString('en-US', { ...options, hour: 'numeric', hour12: false });
        return parseInt(hourStr) || 12;
    }

    private _getMonth(date: Date, options: Intl.DateTimeFormatOptions): number {
        const monthStr = date.toLocaleString('en-US', { ...options, month: 'numeric' });
        return parseInt(monthStr) || 1;
    }

    private _getTimeOfDay(hour: number): TimeWeather['timeOfDay'] {
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 20) return 'evening';
        return 'night';
    }

    private _getSeason(month: number, latitude: number | null): TimeWeather['season'] {
        const isNorthern = (latitude || 0) >= 0;

        if (month >= 12 || month <= 2) return isNorthern ? 'winter' : 'summer';
        if (month >= 3 && month <= 5) return isNorthern ? 'spring' : 'fall';
        if (month >= 6 && month <= 8) return isNorthern ? 'summer' : 'winter';
        return isNorthern ? 'fall' : 'spring';
    }

    private async _fetchWeather(location: LocationData): Promise<ReturnType<typeof WeatherCodes.getDescription>> {
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
        } catch (e) {
            console.warn('Could not fetch weather:', e);
        }

        return WeatherCodes.getDescription(0, 0);
    }
}