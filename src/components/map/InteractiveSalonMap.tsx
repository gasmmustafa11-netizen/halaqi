import React, { useState, useEffect, useRef } from 'react';
import { Salon } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useBooking } from '../../context/BookingContext';
import { calculateDistanceKm, formatDistance, estimateDriveTimeMinutes, getGoogleMapsNavigationUrl } from '../../utils/geo';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  Star,
  Compass,
  Search,
  Calendar,
  LocateFixed,
  Car,
  Clock,
  Sparkles,
  Scissors,
  Radio,
  Plus,
  Minus,
  Maximize2,
  Crosshair,
  Zap,
  RotateCcw
} from 'lucide-react';

interface InteractiveSalonMapProps {
  salons: Salon[];
  onSelectSalon: (salon: Salon) => void;
  selectedCity?: string;
}

const GOOGLE_MAPS_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidGoogleKey = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== 'YOUR_API_KEY';

export const InteractiveSalonMap: React.FC<InteractiveSalonMapProps> = ({
  salons,
  onSelectSalon,
  selectedCity = 'all',
}) => {
  const { t, isRtl } = useLanguage();
  const { openBookingWizard } = useBooking();

  // User location state
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number | null;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Map state
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 33.3152, lng: 44.3661 });
  const [zoom, setZoom] = useState<number>(13);
  const [activeSalon, setActiveSalon] = useState<Salon | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'men' | 'women'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. One-time Geolocation fetch
  const handleGetLocation = () => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError(isRtl ? 'المتصفح لا يدعم تحديد الموقع الجغرافي' : 'Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
        };
        setUserLocation(coords);
        setMapCenter({ lat: coords.lat, lng: coords.lng });
        setZoom(15);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation failed:', err.message);
        setLocationError(
          isRtl
            ? 'لم نتمكن من تحديد موقعك بدقة. يرجى تفعيل أذونات الموقع.'
            : 'Could not access your location. Please check browser permissions.'
        );
        setUserLocation({ lat: 33.3120, lng: 44.3540, accuracy: 20 });
        setIsLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // 2. Continuous Auto-Tracking (WatchPosition)
  const toggleLiveTracking = () => {
    if (isLiveTracking) {
      // Turn off
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsLiveTracking(false);
    } else {
      // Turn on
      if (!navigator.geolocation) {
        setLocationError(isRtl ? 'المتصفح لا يدعم التتبع الجغرافي' : 'Geolocation is not supported');
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
          };
          setUserLocation(coords);
          setMapCenter({ lat: coords.lat, lng: coords.lng });
          setIsLocating(false);
          setIsLiveTracking(true);
        },
        (err) => {
          console.warn('WatchPosition error:', err.message);
          setLocationError(
            isRtl ? 'تعذر تشغيل التتبع التلقائي للموقع.' : 'Failed to track live location.'
          );
          setIsLiveTracking(false);
          setIsLocating(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 10000,
        }
      );

      watchIdRef.current = id;
    }
  };

  // Cleanup watchPosition on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Center on city changes
  useEffect(() => {
    if (selectedCity === 'baghdad') setMapCenter({ lat: 33.3152, lng: 44.3661 });
    else if (selectedCity === 'erbil') setMapCenter({ lat: 36.1912, lng: 44.0092 });
    else if (selectedCity === 'basra') setMapCenter({ lat: 30.5081, lng: 47.7835 });
    else if (selectedCity === 'nasiriyah') setMapCenter({ lat: 31.0539, lng: 46.2573 });
    else if (selectedCity === 'najaf') setMapCenter({ lat: 32.0003, lng: 44.3364 });
    else if (selectedCity === 'karbala') setMapCenter({ lat: 32.6160, lng: 44.0249 });
  }, [selectedCity]);

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(19, prev + 1));
  const handleZoomOut = () => setZoom((prev) => Math.max(7, prev - 1));
  const handleResetView = () => {
    if (userLocation) {
      setMapCenter({ lat: userLocation.lat, lng: userLocation.lng });
      setZoom(14);
    } else {
      setMapCenter({ lat: 33.3152, lng: 44.3661 });
      setZoom(13);
    }
  };

  // Filter salons
  const filteredSalons = salons.filter((s) => {
    const matchesType = filterType === 'all' || s.type === filterType || s.type === 'unisex';
    const matchesQuery =
      !searchQuery.trim() ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.area.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesQuery;
  });

  // Calculate coordinates to SVG container for fallback view
  const minLat = mapCenter.lat - 0.12 / (zoom / 12);
  const maxLat = mapCenter.lat + 0.12 / (zoom / 12);
  const minLng = mapCenter.lng - 0.18 / (zoom / 12);
  const maxLng = mapCenter.lng + 0.18 / (zoom / 12);

  const getSvgCoordinates = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  return (
    <div className="relative w-full h-[650px] lg:h-[720px] rounded-2xl overflow-hidden border border-[#262626] bg-[#0A0A0A] shadow-2xl flex flex-col group">
      {/* Top Map Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search Input on Map */}
        <div className="pointer-events-auto flex items-center bg-[#141414]/95 backdrop-blur-md border border-[#262626] rounded-full px-4 py-2 text-sm shadow-xl w-full sm:w-80 focus-within:border-[#D4AF37] transition-all">
          <Search className="w-4 h-4 text-[#D4AF37] ml-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="bg-transparent border-none outline-none text-white text-xs sm:text-sm w-full placeholder-gray-400 text-start"
          />
        </div>

        {/* Gender / Type filter chips */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-[#141414]/95 backdrop-blur-md border border-[#262626] p-1 rounded-2xl shadow-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            {t('allSalons')}
          </button>
          <button
            onClick={() => setFilterType('men')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              filterType === 'men'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            {t('menSalons')}
          </button>
          <button
            onClick={() => setFilterType('women')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              filterType === 'women'
                ? 'bg-[#D4AF37] text-black shadow-md'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t('womenSalons')}
          </button>
        </div>
      </div>

      {/* Luxury Bento Custom Controls Toolbar (Zoom, Auto-Tracking, Re-center) */}
      <div className="absolute top-20 right-4 z-20 flex flex-col gap-2.5 pointer-events-auto">
        {/* 1. Live GPS Auto-Tracking Button (WatchPosition Toggle) */}
        <button
          onClick={toggleLiveTracking}
          title={
            isLiveTracking
              ? (isRtl ? 'إيقاف التتبع المباشر' : 'Stop Live Tracking')
              : (isRtl ? 'تفعيل التتبع التلقائي المباشر (GPS Watch)' : 'Start Live GPS Auto-Tracking')
          }
          className={`p-3 rounded-2xl backdrop-blur-md border shadow-2xl transition-all flex items-center justify-center cursor-pointer group/btn ${
            isLiveTracking
              ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] scale-105'
              : 'bg-[#141414]/95 border-[#262626] text-gray-300 hover:text-[#D4AF37] hover:border-[#D4AF37]'
          }`}
        >
          <div className="relative">
            <Radio
              className={`w-5 h-5 ${isLiveTracking ? 'animate-pulse' : ''}`}
            />
            {isLiveTracking && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            )}
          </div>
        </button>

        {/* 2. One-click locate position */}
        <button
          onClick={handleGetLocation}
          title={isRtl ? 'تحديد موقعي الآن' : 'Locate my position'}
          className={`p-3 rounded-2xl bg-[#141414]/95 backdrop-blur-md border border-[#262626] text-gray-200 shadow-2xl hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all flex items-center justify-center cursor-pointer ${
            isLocating ? 'animate-pulse text-[#D4AF37]' : ''
          }`}
        >
          <LocateFixed className="w-5 h-5" />
        </button>

        {/* 3. Luxury Bento Zoom Slider / Step Buttons */}
        <div className="flex flex-col bg-[#141414]/95 backdrop-blur-md border border-[#262626] rounded-2xl overflow-hidden shadow-2xl">
          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            title={isRtl ? 'تكبير الخريطة' : 'Zoom In'}
            className="p-3 text-gray-200 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center border-b border-[#262626] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Zoom Level Indicator */}
          <div className="py-1 text-center text-[10px] font-mono text-gray-400 font-bold border-b border-[#262626] select-none bg-[#1a1a1a]">
            {zoom}x
          </div>

          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            title={isRtl ? 'تصغير الخريطة' : 'Zoom Out'}
            className="p-3 text-gray-200 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* 4. Reset & Recenter View Button */}
        <button
          onClick={handleResetView}
          title={isRtl ? 'إعادة ضبط المنظور للمركز' : 'Reset View to Center'}
          className="p-3 rounded-2xl bg-[#141414]/95 backdrop-blur-md border border-[#262626] text-gray-300 shadow-2xl hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all flex items-center justify-center cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Live Tracking Status Badge Overlay */}
      {isLiveTracking && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[#141414]/95 border border-[#D4AF37] text-white text-xs px-4 py-1.5 rounded-full backdrop-blur-md shadow-2xl flex items-center gap-2 animate-in fade-in">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          <span className="font-bold text-[#D4AF37]">التتبع المباشر نشط</span>
          <span className="text-[10px] text-gray-400 font-mono">
            {userLocation?.accuracy ? `(دقة ±${Math.round(userLocation.accuracy)}م)` : ''}
          </span>
        </div>
      )}

      {/* Location Error Alert */}
      {locationError && (
        <div className="absolute top-18 left-4 right-4 z-20 bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs px-4 py-2.5 rounded-2xl backdrop-blur-md shadow-2xl flex items-center justify-between">
          <span>{locationError}</span>
          <button onClick={() => setLocationError(null)} className="text-amber-400 font-bold px-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Official Google Maps Render OR Built-in Interactive Vector Map */}
      <div className="relative flex-1 w-full h-full bg-[#0A0A0A] overflow-hidden select-none">
        {hasValidGoogleKey ? (
          /* Official Google Maps Platform */
          <APIProvider apiKey={GOOGLE_MAPS_KEY} version="weekly">
            <Map
              center={mapCenter}
              zoom={zoom}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              disableDefaultUI={true}
              onCameraChanged={(e) => {
                setMapCenter(e.detail.center);
                setZoom(e.detail.zoom);
              }}
            >
              {userLocation && (
                <AdvancedMarker position={userLocation} title={t('youAreHere')}>
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-12 h-12 bg-sky-500/30 rounded-full animate-ping" />
                    <Pin background="#0284c7" glyphColor="#ffffff" borderColor="#ffffff" />
                  </div>
                </AdvancedMarker>
              )}

              {filteredSalons.map((salon) => (
                <AdvancedMarker
                  key={salon.id}
                  position={{ lat: salon.lat, lng: salon.lng }}
                  onClick={() => setActiveSalon(salon)}
                  title={salon.name}
                >
                  <Pin
                    background={salon.type === 'women' ? '#db2777' : '#D4AF37'}
                    glyphColor="#000000"
                    borderColor="#ffffff"
                  />
                </AdvancedMarker>
              ))}
            </Map>
          </APIProvider>
        ) : (
          /* Built-in Luxury Vector & GPS Navigation Map */
          <>
            {/* Ambient Street Grid Styling */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 50% 50%, rgba(212, 175, 55, 0.08) 0%, transparent 80%),
                  linear-gradient(to right, #262626 1px, transparent 1px),
                  linear-gradient(to bottom, #262626 1px, transparent 1px)
                `,
                backgroundSize: '100% 100%, 40px 40px, 40px 40px',
              }}
            />

            {/* River Tigris / Euphrates decorative curve */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
              <path
                d="M 0,200 Q 250,300 500,220 T 1000,450"
                fill="none"
                stroke="#1e3a5f"
                strokeWidth="24"
                strokeLinecap="round"
              />
              <path
                d="M 100,0 Q 300,350 700,400 T 1000,600"
                fill="none"
                stroke="#1a2e4c"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <line x1="10%" y1="20%" x2="90%" y2="80%" stroke="#262626" strokeWidth="6" />
              <line x1="20%" y1="85%" x2="85%" y2="15%" stroke="#262626" strokeWidth="6" />
              <circle cx="50%" cy="50%" r="180" fill="none" stroke="#262626" strokeWidth="4" strokeDasharray="6 6" />
            </svg>

            {/* User GPS Location Marker with Live Pulse */}
            {userLocation && (
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none transition-all duration-500 ease-out"
                style={{
                  left: `${getSvgCoordinates(userLocation.lat, userLocation.lng).x}%`,
                  top: `${getSvgCoordinates(userLocation.lat, userLocation.lng).y}%`,
                }}
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-14 h-14 bg-sky-500/20 rounded-full animate-ping" />
                  <div className="absolute w-8 h-8 bg-sky-500/40 rounded-full animate-pulse" />
                  <div className="w-4 h-4 bg-sky-400 border-2 border-white rounded-full shadow-lg shadow-sky-500/50" />
                  <div className="absolute -bottom-6 bg-[#141414] border border-sky-400/50 text-sky-200 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                    <span>{t('youAreHere')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Salon Map Pins */}
            {filteredSalons.map((salon) => {
              const coords = getSvgCoordinates(salon.lat, salon.lng);
              const isSelected = activeSalon?.id === salon.id;

              return (
                <div
                  key={salon.id}
                  className="absolute transform -translate-x-1/2 -translate-y-full cursor-pointer z-10 transition-transform duration-200 hover:scale-110"
                  style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                  onClick={() => setActiveSalon(salon)}
                >
                  <div className="relative flex flex-col items-center group">
                    <div
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold shadow-xl border flex items-center gap-1 mb-1 transition-all whitespace-nowrap ${
                        isSelected
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] scale-105 ring-2 ring-[#D4AF37]/50'
                          : salon.type === 'women'
                          ? 'bg-[#141414] text-pink-200 border-pink-500/30'
                          : 'bg-[#141414] text-amber-200 border-[#262626]'
                      }`}
                    >
                      {salon.type === 'women' ? (
                        <Sparkles className="w-3 h-3 text-pink-400" />
                      ) : (
                        <Scissors className="w-3 h-3 text-[#D4AF37]" />
                      )}
                      <span>{salon.name}</span>
                      <span className="opacity-75 font-mono text-[9px] ms-1">★ {salon.rating}</span>
                    </div>

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shadow-2xl border-2 transition-all ${
                        isSelected
                          ? 'bg-[#D4AF37] text-black border-white shadow-[#D4AF37]/60'
                          : salon.type === 'women'
                          ? 'bg-pink-950 text-pink-300 border-pink-400'
                          : 'bg-[#141414] text-[#D4AF37] border-[#D4AF37]'
                      }`}
                    >
                      <MapPin className="w-4 h-4 fill-current" />
                    </div>

                    <div
                      className={`w-1.5 h-2 -mt-0.5 rounded-b-sm ${
                        isSelected ? 'bg-[#D4AF37]' : salon.type === 'women' ? 'bg-pink-400' : 'bg-[#D4AF37]'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Selected Salon Info Card Drawer */}
      {activeSalon && (
        <div className="absolute bottom-4 left-4 right-4 z-20 bg-[#141414]/95 backdrop-blur-xl border border-[#262626] rounded-2xl p-4 shadow-2xl text-white transition-all animate-in fade-in slide-in-from-bottom-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Salon Details */}
            <div className="flex items-center gap-3.5">
              <img
                src={activeSalon.coverImage}
                alt={activeSalon.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-[#262626] shrink-0"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base sm:text-lg text-white">{activeSalon.name}</h4>
                  {activeSalon.isVerified && (
                    <span className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                      {t('verifiedSalon')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#D4AF37]" />
                  {activeSalon.address}
                </p>

                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {activeSalon.rating}
                    <span className="text-gray-400 font-normal">({activeSalon.reviewCount})</span>
                  </span>

                  <span className="text-gray-500">•</span>

                  <span className="text-[#D4AF37] font-semibold font-mono">
                    {t('startingFrom')} {activeSalon.startingPrice.toLocaleString()} {t('iqd')}
                  </span>

                  {userLocation && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="flex items-center gap-1 text-sky-400 font-semibold">
                        <Car className="w-3 h-3" />
                        {formatDistance(
                          calculateDistanceKm(userLocation.lat, userLocation.lng, activeSalon.lat, activeSalon.lng),
                          isRtl
                        )}
                        <span className="text-gray-400 text-[10px]">
                          (~
                          {estimateDriveTimeMinutes(
                            calculateDistanceKm(userLocation.lat, userLocation.lng, activeSalon.lat, activeSalon.lng)
                          )}{' '}
                          {t('minutes')})
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              <a
                href={getGoogleMapsNavigationUrl(activeSalon.lat, activeSalon.lng, activeSalon.name)}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333] text-xs text-gray-200 flex items-center gap-1.5 transition-colors border border-[#333] cursor-pointer"
                title={t('openGoogleMaps')}
              >
                <Navigation className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">{t('getDirections')}</span>
              </a>

              <button
                onClick={() => onSelectSalon(activeSalon)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-colors border border-white/10 cursor-pointer"
              >
                {t('viewSalon')}
              </button>

              <button
                onClick={() => openBookingWizard(activeSalon)}
                className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#B8962D] text-xs font-bold text-black shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                {t('bookNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Footer Notice */}
      <div className="absolute bottom-2 left-3 z-10 text-[10px] text-gray-500 flex items-center gap-2 pointer-events-none">
        <span>HALAQI Maps Engine • GPS Real-Time Tracking</span>
      </div>
    </div>
  );
};
