/**
 * types.ts - Shared type definitions for API module
 */

export interface ApiError {
    type: 'API_KEY_EXPIRED' | 'API_KEY_INVALID' | 'QUOTA_EXCEEDED' | 'MODEL_NOT_FOUND' | 'API_ERROR' | 'UNKNOWN_ERROR';
    message: string;
    originalMessage?: string;
    code: number;
    action?: string;
}

export interface LocationData {
    city: string;
    region: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    timezone: string;
}

export interface WeatherReport {
    description: string;
    hasPrecipitation: boolean;
    precipitationType: string;
    weatherCode: number;
}

export interface TimeWeather {
    timeString: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'day';
    hour: number;
    season: 'spring' | 'summer' | 'fall' | 'winter';
    weatherReport: WeatherReport;
}

export interface BackgroundData {
    frames: string[];
    frameCount: number;
    frameWidth: number;
    frameHeight: number;
    spritesheet?: string;
}

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface BackgroundMeta {
    location?: LocationData;
    timeWeather?: TimeWeather;
    prompt?: string;
    timestamp: number;
    version: number;
    frameCount?: number;
    frameWidth?: number;
    frameHeight?: number;
    cached: boolean;
}

export interface EnemySpriteMeta {
    timestamp: number;
    type: string;
    version: number;
    compressed?: boolean;
}

export type ProgressCallback = (current: number, total: number) => void;

