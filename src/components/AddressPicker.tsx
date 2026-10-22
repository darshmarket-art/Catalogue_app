import React, { useEffect, useRef, useState } from 'react';

/* Google Maps is loaded only on this screen, with the browser key the server hands out (GOOGLE_MAPS_KEY). */
type G = any; // the Maps JavaScript API has no types installed; this file is the only user
let loading: Promise<G> | null = null;
function loadMaps(key: string): Promise<G> {
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google.maps);
  loading ??= new Promise((resolve, reject) => {
    w.__axMapsReady = () => resolve(w.google.maps);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__axMapsReady&region=IN&language=en`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error('Google Maps could not be loaded.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

const INDIA = { lat: 20.59, lng: 78.96 };
const toPin = (ll: G) => `${ll.lat().toFixed(6)},${ll.lng().toFixed(6)}`;

interface Props {
  /** "lat,lng" picked earlier, if any. */
  pin?: string;
  /** A place was chosen: its full address and "lat,lng". */
  onPick: (address: string, pin: string) => void;
}

/**
 * Address search with Google's suggestions, and a map to set the exact spot (tap the map or drag the pin).
 * Shows nothing when Maps is not set up or cannot load, so the plain address box below still works.
 */
export const AddressPicker: React.FC<Props> = ({ pin, onPick }) => {
  const searchRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [state, setState] = useState<'loading' | 'ready' | 'off'>('loading');

  useEffect(() => {
    let live = true;
    const w = window as any;
    w.gm_authFailure = () => setState('off'); // a wrong or unauthorised key: fall back to the plain box
    void (async () => {
      try {
        const cfg = await fetch('/api/app-config').then((r) => r.json());
        const key: string | null = cfg?.data?.googleMapsKey ?? null;
        if (!key) return void (live && setState('off'));
        const maps = await loadMaps(key);
        const [{ Map }, { PlaceAutocompleteElement }, { Marker }, { Geocoder }] = await Promise.all([
          maps.importLibrary('maps'),
          maps.importLibrary('places'),
          maps.importLibrary('marker'),
          maps.importLibrary('geocoding')
        ]);
        if (!live || !mapRef.current || !searchRef.current) return;
        const [lat, lng] = (pin ?? '').split(',').map(Number);
        const start = pin ? { lat, lng } : INDIA;
        const map = new Map(mapRef.current, { center: start, zoom: pin ? 16 : 4, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false });
        const marker = new Marker({ map, position: pin ? start : null, draggable: true });
        const geocoder = new Geocoder();
        const at = async (ll: G) => {
          marker.setPosition(ll);
          const { results } = await geocoder.geocode({ location: ll }).catch(() => ({ results: [] }));
          pick.current(results[0]?.formatted_address ?? '', toPin(ll));
        };
        map.addListener('click', (e: G) => void at(e.latLng));
        marker.addListener('dragend', (e: G) => void at(e.latLng));

        const search = new PlaceAutocompleteElement({ includedRegionCodes: ['in'] });
        search.setAttribute('placeholder', 'Search your shop or area on Google Maps');
        searchRef.current.replaceChildren(search);
        const chosen = async (place: G) => {
          await place.fetchFields({ fields: ['formattedAddress', 'location'] });
          if (!place.location) return;
          map.setCenter(place.location);
          map.setZoom(17);
          marker.setPosition(place.location);
          pick.current(place.formattedAddress ?? '', toPin(place.location));
        };
        search.addEventListener('gmp-select', (e: G) => void chosen(e.placePrediction.toPlace())); // current API
        search.addEventListener('gmp-placeselect', (e: G) => void chosen(e.place)); // older releases
        setState('ready');
      } catch {
        if (live) setState('off');
      }
    })();
    return () => {
      live = false;
    };
    // the map is set up once; later pins come from the map itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'off') return null;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div ref={searchRef} />
      <div ref={mapRef} style={{ height: 220, borderRadius: 14, overflow: 'hidden', background: 'var(--em-tint, #eee7df)' }} aria-label="Map: tap or drag the pin to your shop" />
      <small className="em-mut">{state === 'loading' ? 'Loading Google Maps…' : 'Search above, or tap the map and drag the pin to your exact shop.'}</small>
    </div>
  );
};
