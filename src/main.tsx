import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CarFront,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gem,
  Heart,
  Images,
  Luggage,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MoonStar,
  PartyPopper,
  Phone,
  Plane,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './styles.css';

type Icon = LucideIcon;

declare global {
  interface Window {
    GTA_PARTY_LIMOS_WEB3FORMS_ACCESS_KEY?: string;
    GTA_PARTY_LIMOS_GOOGLE_MAPS?: {
      apiKey: string;
      placesEnabled?: boolean;
    };
    gm_authFailure?: () => void;
    google?: any;
  }
}

type FleetItem = {
  name: string;
  slug: string;
  passengers: string;
  image: string;
  idealFor: string;
  features: string[];
};

type Service = {
  slug: string;
  title: string;
  navTitle?: string;
  eyebrow: string;
  summary: string;
  detail: string;
  icon: Icon;
  image: string;
  inclusions: string[];
  proof: string;
};

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';

let googleMapsLoadPromise: Promise<void> | null = null;
let googleMapsAuthFailed = false;

function loadGooglePlaces() {
  const mapsConfig = window.GTA_PARTY_LIMOS_GOOGLE_MAPS;

  if (!mapsConfig?.placesEnabled || !mapsConfig.apiKey) return null;
  if (googleMapsAuthFailed) return null;
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-places="gta-party-limos"]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (googleMapsAuthFailed || !window.google?.maps?.places) {
          reject(new Error('Google Maps Places unavailable'));
          return;
        }
        resolve();
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')), { once: true });
      return;
    }

    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      googleMapsAuthFailed = true;
      previousAuthFailure?.();
      reject(new Error('Google Maps authorization failed'));
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsConfig.apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googlePlaces = 'gta-party-limos';
    script.onload = () => {
      if (googleMapsAuthFailed || !window.google?.maps?.places) {
        reject(new Error('Google Maps Places unavailable'));
        return;
      }
      resolve();
    };
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

function usePlacesAutocomplete(inputRef: React.RefObject<HTMLInputElement>, active = true) {
  useEffect(() => {
    let autocomplete: any;
    let listener: any;
    let lastKnownScrollY = window.scrollY;
    let removeInteractionGuards: (() => void) | undefined;

    const setup = async () => {
      if (!active) return;
      const loader = loadGooglePlaces();
      if (!loader || !inputRef.current) return;

      try {
        await loader;
        if (!inputRef.current || !window.google?.maps?.places) return;

        autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'ca' },
          fields: ['formatted_address', 'name'],
          types: ['geocode', 'establishment'],
        });

        const rememberScrollPosition = () => {
          lastKnownScrollY = window.scrollY;
        };

        const rememberAutocompleteClick = (event: Event) => {
          const target = event.target as Element | null;
          if (target?.closest('.pac-container')) rememberScrollPosition();
        };

        inputRef.current.addEventListener('focus', rememberScrollPosition);
        inputRef.current.addEventListener('input', rememberScrollPosition);
        inputRef.current.addEventListener('keydown', rememberScrollPosition);
        document.addEventListener('mousedown', rememberAutocompleteClick, true);
        document.addEventListener('touchstart', rememberAutocompleteClick, true);

        removeInteractionGuards = () => {
          inputRef.current?.removeEventListener('focus', rememberScrollPosition);
          inputRef.current?.removeEventListener('input', rememberScrollPosition);
          inputRef.current?.removeEventListener('keydown', rememberScrollPosition);
          document.removeEventListener('mousedown', rememberAutocompleteClick, true);
          document.removeEventListener('touchstart', rememberAutocompleteClick, true);
        };

        listener = autocomplete.addListener('place_changed', () => {
          const targetScrollY = lastKnownScrollY;
          const place = autocomplete.getPlace();
          const value = place.formatted_address || place.name;
          if (value && inputRef.current) {
            inputRef.current.value = value;

            const keepAddressFieldInPlace = () => {
              inputRef.current?.focus({ preventScroll: true });
              window.scrollTo({ top: targetScrollY, left: window.scrollX, behavior: 'auto' });
            };

            window.requestAnimationFrame(() => {
              keepAddressFieldInPlace();
              window.requestAnimationFrame(keepAddressFieldInPlace);
            });
          }
        });
      } catch {
        // Manual address entry remains available if Google Places cannot load.
      }
    };

    setup();

    return () => {
      removeInteractionGuards?.();
      if (listener?.remove) listener.remove();
      if (autocomplete) autocomplete.unbindAll?.();
    };
  }, [active, inputRef]);
}

function getFormFieldValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
    return field.value.trim();
  }
  return '';
}

function setHiddenFormField(form: HTMLFormElement, name: string, value: string) {
  let field = form.elements.namedItem(name) as HTMLInputElement | null;

  if (!(field instanceof HTMLInputElement)) {
    field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    form.appendChild(field);
  }

  field.value = value;
}

function formatDistance(kilometers: number) {
  if (!Number.isFinite(kilometers) || kilometers <= 0) return '';
  return `${kilometers.toFixed(kilometers >= 10 ? 1 : 2)} km`;
}

function calculateDrivingDistanceMeters(origin: string, destination: string) {
  return new Promise<number>((resolve, reject) => {
    if (!window.google?.maps?.DirectionsService || !window.google.maps.TravelMode) {
      reject(new Error('Google directions unavailable'));
      return;
    }

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (status !== 'OK') {
          reject(new Error(`Google directions failed: ${status}`));
          return;
        }

        const meters = result?.routes?.[0]?.legs?.reduce((total: number, leg: any) => {
          return total + Number(leg?.distance?.value || 0);
        }, 0);

        if (!meters) {
          reject(new Error('Google directions returned no distance'));
          return;
        }

        resolve(meters);
      },
    );
  });
}

async function populateDistanceFields(form: HTMLFormElement) {
  if (!form.elements.namedItem('pickup_location') || !form.elements.namedItem('dropoff_location')) return;

  const pickup = getFormFieldValue(form, 'pickup_location');
  const dropoff = getFormFieldValue(form, 'dropoff_location');
  const returnTripRequired = getFormFieldValue(form, 'return_trip_required');
  const returnAddress = getFormFieldValue(form, 'return_address');

  setHiddenFormField(form, 'estimated_outbound_distance', '');
  setHiddenFormField(form, 'estimated_return_distance', '');
  setHiddenFormField(form, 'estimated_total_distance', '');
  setHiddenFormField(form, 'estimated_distance_note', '');

  if (!pickup || !dropoff) {
    setHiddenFormField(form, 'estimated_distance_note', 'Not calculated - pickup or drop-off location was missing.');
    return;
  }

  const loader = loadGooglePlaces();
  if (!loader) {
    setHiddenFormField(form, 'estimated_distance_note', 'Not calculated - Google Maps was unavailable.');
    return;
  }

  try {
    await loader;

    const outboundMeters = await calculateDrivingDistanceMeters(pickup, dropoff);
    let returnMeters = 0;

    if (returnTripRequired === 'Yes' && returnAddress) {
      returnMeters = await calculateDrivingDistanceMeters(dropoff, returnAddress);
    }

    const outboundKm = outboundMeters / 1000;
    const returnKm = returnMeters / 1000;
    const totalKm = outboundKm + returnKm;

    setHiddenFormField(form, 'estimated_outbound_distance', formatDistance(outboundKm));
    setHiddenFormField(form, 'estimated_return_distance', returnKm ? formatDistance(returnKm) : 'No return distance calculated');
    setHiddenFormField(form, 'estimated_total_distance', formatDistance(totalKm));
    setHiddenFormField(
      form,
      'estimated_distance_note',
      returnTripRequired === 'Yes'
        ? 'Estimated driving distance includes outbound and return-trip routing.'
        : 'Estimated driving distance includes outbound routing only.',
    );
  } catch {
    setHiddenFormField(form, 'estimated_distance_note', 'Not calculated - Google Maps could not estimate this route.');
  }
}

const contact = {
  phone: '647-222-7300',
  phoneHref: 'tel:6472227300',
  email: 'info@GTAPartyLimos.com',
  emailHref: 'mailto:info@GTAPartyLimos.com',
  domain: 'gtapartylimos.com',
};

const areas = [
  'Toronto',
  'Mississauga',
  'Brampton',
  'Vaughan',
  'Markham',
  'Richmond Hill',
  'Oakville',
  'Burlington',
  'Etobicoke',
  'Scarborough',
  'North York',
  'Ajax',
  'Pickering',
  'Whitby',
  'Oshawa',
  'Milton',
  'Hamilton',
  'King City',
];

const fleet: FleetItem[] = [
  {
    name: 'Black Stretch Limousines',
    slug: 'stretch-limos',
    passengers: 'Up to 10 guests',
    image: '/assets/img/hero-limo-v2.jpg',
    idealFor: 'Weddings, proms, anniversaries, dinners, and VIP nights out.',
    features: ['Leather seating', 'Privacy partition', 'Premium sound', 'Chilled bottled water'],
  },
  {
    name: 'SUV Limos',
    slug: 'suv-limos',
    passengers: 'Up to 14 guests',
    image: '/assets/img/chauffeur-airport-v2.jpg',
    idealFor: 'Airport transfers, corporate groups, concerts, and sporting events.',
    features: ['Commanding curb presence', 'Luggage space', 'Chauffeur door service', 'Smooth long-distance ride'],
  },
  {
    name: 'Party Limos',
    slug: 'party-limos',
    passengers: 'Up to 18 guests',
    image: '/assets/img/party-bus-interior-v2.jpg',
    idealFor: 'Birthdays, bachelorettes, bachelor parties, and nightlife routes.',
    features: ['LED ambience', 'Wraparound lounge seating', 'Bluetooth audio', 'Celebration-ready cabin'],
  },
  {
    name: 'Party Buses',
    slug: 'party-buses',
    passengers: 'Up to 30 guests',
    image: '/assets/img/party-bus-interior-v2.jpg',
    idealFor: 'Large groups, winery tours, wedding shuttles, and club crawls.',
    features: ['Spacious aisle', 'Group-friendly layout', 'Multiple stops', 'Premium onboard lighting'],
  },
];

const services: Service[] = [
  {
    slug: 'limo-rentals',
    title: 'Limo Rentals',
    eyebrow: 'Classic luxury, modern booking',
    summary: 'Premium stretch limousine and SUV limo rentals for polished arrivals across Toronto and the GTA.',
    detail:
      'Choose a clean, chauffeur-driven limo for dinner reservations, proposals, milestone celebrations, client arrivals, or a refined night in the city. We match vehicle size, route timing, and pickup details so the entire ride feels effortless.',
    icon: CarFront,
    image: '/assets/img/hero-limo-v2.jpg',
    inclusions: ['Fast quote confirmation', 'Clean premium vehicles', 'Professional chauffeurs', 'Point-to-point or hourly service'],
    proof: 'A polished choice for date nights, hotel pickups, galas, and private celebrations.',
  },
  {
    slug: 'party-limos',
    title: 'Party Limos',
    eyebrow: 'Nightlife energy without the logistics',
    summary: 'Celebration-ready party limos and party buses with room for friends, music, photos, and multiple stops.',
    detail:
      'Your group gets the fun of a private lounge and the structure of professional transportation. We help plan the pickup window, route, club stops, dinner timing, and safe ride home so the night stays moving.',
    icon: PartyPopper,
    image: '/assets/img/party-bus-interior-v2.jpg',
    inclusions: ['LED lighting', 'Premium sound', 'Multi-stop itineraries', 'Bachelor, bachelorette, and birthday packages'],
    proof: 'Built for birthdays, club crawls, concerts, and every group that wants the night to start at pickup.',
  },
  {
    slug: 'wedding-limos',
    title: 'Wedding Limos',
    eyebrow: 'Elegant arrivals, calm timelines',
    summary: 'Luxury wedding transportation for couples, wedding parties, families, photo locations, and reception exits.',
    detail:
      'Wedding day transportation has to feel beautiful and run precisely. We coordinate pickup timing, photo stops, ceremony arrivals, reception transfers, and late-night exits with a calm professional approach.',
    icon: Heart,
    image: '/assets/img/wedding-limo-v2.jpg',
    inclusions: ['Bride and groom service', 'Wedding party vehicles', 'Family guest shuttles', 'Photo-location routing'],
    proof: 'Ideal for venues across Toronto, Mississauga, Vaughan, Markham, Brampton, and the wider GTA.',
  },
  {
    slug: 'prom-limos',
    title: 'Prom Limos',
    eyebrow: 'Memorable, supervised, on schedule',
    summary: 'Stylish prom limo and party bus rentals with professional chauffeurs and parent-friendly coordination.',
    detail:
      'Prom should feel special, not stressful. We support clear pickup plans, passenger counts, route details, timing, and driver communication for a safe and impressive arrival.',
    icon: Sparkles,
    image: '/assets/img/hero-limo-v2.jpg',
    inclusions: ['Group pickup planning', 'Photo-ready arrivals', 'Parent communication', 'Clean, inspected vehicles'],
    proof: 'Popular for Toronto, Peel, York, Durham, and Halton school celebrations.',
  },
  {
    slug: 'bachelor-bachelorette-limos',
    title: 'Bachelor/Bachelorette Limos',
    navTitle: 'Bachelor/Bachelorette',
    eyebrow: 'The whole crew, one smooth night',
    summary: 'Private limo and party bus routes for bachelor and bachelorette nights, dinners, clubs, wineries, and events.',
    detail:
      'From the first pickup to the final drop-off, we make group movement easy. Tell us the guest count and stops, and we will recommend the right vehicle and booking window.',
    icon: Users,
    image: '/assets/img/party-bus-interior-v2.jpg',
    inclusions: ['Club and lounge routes', 'Dinner-to-event timing', 'Winery and casino trips', 'Safe late-night returns'],
    proof: 'A premium way to keep the group together without rideshare chaos.',
  },
  {
    slug: 'birthday-limos',
    title: 'Birthday Limos',
    eyebrow: 'Make the ride part of the celebration',
    summary: 'Birthday limo rentals for dinners, surprise parties, nightlife, concerts, sporting events, and milestone plans.',
    detail:
      'Whether it is an intimate limo for a special dinner or a party bus for a full group, we make the birthday feel elevated from the moment the door opens.',
    icon: Gem,
    image: '/assets/img/party-bus-interior-v2.jpg',
    inclusions: ['Milestone packages', 'Restaurant and club stops', 'Concert and arena transfers', 'Custom itineraries'],
    proof: 'Great for Sweet 16s, 19th birthdays, 30ths, 40ths, 50ths, and private VIP nights.',
  },
  {
    slug: 'corporate-transportation',
    title: 'Corporate Transportation',
    eyebrow: 'Quiet luxury for business travel',
    summary: 'Executive black-car, SUV, and group transportation for meetings, conferences, clients, and roadshows.',
    detail:
      'Business travel needs punctuality, discretion, and a clean vehicle. Our corporate transportation supports airport pickups, client hosting, event transfers, and executive schedules across the GTA.',
    icon: BriefcaseBusiness,
    image: '/assets/img/chauffeur-airport-v2.jpg',
    inclusions: ['Executive airport pickups', 'Client transportation', 'Conference shuttles', 'Hourly standby service'],
    proof: 'Designed for teams that need the ride to feel premium and run on time.',
  },
  {
    slug: 'airport-transfers',
    title: 'Airport Transfers',
    eyebrow: 'Pearson, Billy Bishop, private aviation',
    summary: 'Premium airport limo and SUV transfers with route planning, luggage support, and chauffeur coordination.',
    detail:
      'Start or end the trip cleanly with a professional airport transfer. We service Pearson, Billy Bishop, FBO/private aviation, hotels, residences, and corporate offices.',
    icon: Plane,
    image: '/assets/img/chauffeur-airport-v2.jpg',
    inclusions: ['Airport pickups and drop-offs', 'Luggage-friendly vehicles', 'Early morning service', 'Corporate accounts'],
    proof: 'A refined choice for travelers who want comfort, timing, and a smooth curbside experience.',
  },
  {
    slug: 'nights-out-events',
    title: 'Nights Out / Events',
    eyebrow: 'Concerts, games, dinners, VIP routes',
    summary: 'Luxury transportation for Toronto nights out, concerts, sporting events, festivals, theatres, and private parties.',
    detail:
      'Skip parking, coordination, and surge pricing. We handle the pickup plan, venue timing, after-event wait windows, and multi-stop routes for a polished night out.',
    icon: MoonStar,
    image: '/assets/img/hero-limo-v2.jpg',
    inclusions: ['Scotiabank Arena and Rogers Centre', 'Concerts and festivals', 'Theatre and dinner routes', 'VIP club arrivals'],
    proof: 'Perfect for groups that want the city experience to feel seamless.',
  },
];

const testimonials = [
  {
    name: 'Melissa R.',
    occasion: 'Wedding transportation',
    text: 'The limo arrived early, the car was spotless, and our driver kept the whole wedding party calm and on schedule. It felt genuinely premium.',
  },
  {
    name: 'Arjun S.',
    occasion: 'Bachelor party',
    text: 'We booked a party limo for dinner and clubs downtown. The route was handled perfectly and nobody had to worry about parking or rideshares.',
  },
  {
    name: 'Samantha K.',
    occasion: 'Prom limo',
    text: 'The vehicle looked amazing in photos, the chauffeur was professional, and the parents appreciated the clear pickup and drop-off communication.',
  },
  {
    name: 'Daniel M.',
    occasion: 'Airport transfer',
    text: 'Clean SUV, smooth pickup, and a driver who actually tracked timing. A much better experience than a standard car service.',
  },
  {
    name: 'Priya N.',
    occasion: 'Birthday night out',
    text: 'Our birthday group loved the lighting and sound system. The quote was quick, the vehicle matched expectations, and the night felt VIP.',
  },
];

const faqs = [
  {
    question: 'How fast can I get a limo quote?',
    answer:
      'Most requests receive a fast response after you submit the quote form. For same-day or urgent bookings, calling is the quickest way to confirm availability.',
  },
  {
    question: 'Do you serve the entire GTA?',
    answer:
      'Yes. GTA Party Limos serves Toronto, Mississauga, Brampton, Vaughan, Markham, Richmond Hill, Oakville, Burlington, Durham Region, and surrounding areas.',
  },
  {
    question: 'Can I book multiple stops?',
    answer:
      'Absolutely. Party limo, wedding, birthday, bachelor/bachelorette, and event bookings often include custom pickup points, photo stops, restaurants, venues, and late-night returns.',
  },
  {
    question: 'What vehicle should I choose?',
    answer:
      'Tell us your passenger count, occasion, pickup date, and itinerary. We will recommend a stretch limo, SUV limo, party limo, party bus, or executive SUV based on comfort and timing.',
  },
  {
    question: 'Do you handle weddings and proms?',
    answer:
      'Yes. We coordinate wedding day schedules, prom arrivals, group transportation, parent-friendly timing, and photo-ready vehicles for major milestone events.',
  },
  {
    question: 'Is a deposit required?',
    answer:
      'A deposit is typically required to secure your vehicle and date. Final pricing and payment details are confirmed after availability, itinerary, and vehicle selection are reviewed.',
  },
  {
    question: 'How far in advance should I book?',
    answer:
      'For weddings, proms, holidays, long weekends, and Saturday nights, booking as early as possible is recommended. For smaller transfers or weekday trips, availability may be easier, but early requests still give you the best vehicle options.',
  },
  {
    question: 'Do you offer same-day limo bookings?',
    answer:
      'Same-day bookings may be available depending on vehicle location, chauffeur availability, route timing, and passenger count. Call for urgent requests because form submissions may take longer to review.',
  },
  {
    question: 'What information do you need for an accurate quote?',
    answer:
      'The most helpful details are pickup date, pickup time, pickup location, drop-off location, number of passengers, event type, preferred vehicle, extra stops, wait time, and whether a return trip is needed.',
  },
  {
    question: 'Are prices hourly or flat rate?',
    answer:
      'Pricing depends on the service type. Some trips may be quoted as point-to-point transfers, while weddings, parties, nights out, and multi-stop events are often quoted by package or hourly booking window.',
  },
  {
    question: 'Is gratuity included in the quote?',
    answer:
      'Gratuity policies can vary by booking. If gratuity, taxes, fuel, airport fees, parking, tolls, wait time, cleaning fees, or overtime charges apply, they should be confirmed before the booking is finalized.',
  },
  {
    question: 'Can we make changes after booking?',
    answer:
      'Route, timing, passenger count, and stop changes may be possible if the schedule allows. Changes can affect pricing, vehicle suitability, and chauffeur timing, so it is best to share updates as early as possible.',
  },
  {
    question: 'What happens if our event runs late?',
    answer:
      'Extra time may be available depending on the chauffeur schedule and vehicle availability. Overtime is usually billed according to the confirmed booking terms, so ask about overtime rules before your event.',
  },
  {
    question: 'Do you allow food or drinks in the limo?',
    answer:
      'Food and beverage rules depend on the vehicle, occasion, age of passengers, and booking terms. Alcohol and cannabis must comply with Ontario law. Cleaning or damage fees may apply for spills or mess.',
  },
  {
    question: 'Can minors book a prom limo?',
    answer:
      'Prom transportation usually requires parent or guardian coordination, accurate passenger details, clear pickup and drop-off plans, and compliance with school and Ontario rules. Adult booking confirmation may be required.',
  },
  {
    question: 'Do you provide airport pickup service?',
    answer:
      'Yes. Airport transfers can be arranged for Pearson, Billy Bishop, hotels, homes, offices, and private aviation. Share flight details, luggage count, passenger count, and pickup timing when requesting a quote.',
  },
  {
    question: 'Can you handle multiple pickup locations?',
    answer:
      'Yes, multiple pickups are common for weddings, proms, birthdays, bachelor and bachelorette parties, corporate events, and nights out. Extra stops may affect the required booking time and final price.',
  },
  {
    question: 'How many passengers can fit in each vehicle?',
    answer:
      'Capacity depends on the specific vehicle. Comfort matters, so it is better to provide the exact passenger count, luggage count, and event type so the right limo, SUV limo, or party bus can be recommended.',
  },
  {
    question: 'Can we request a specific vehicle?',
    answer:
      'You can request a preferred vehicle style, such as stretch limo, SUV limo, party limo, party bus, or executive SUV. Final vehicle assignment depends on availability, route, passenger count, and booking confirmation.',
  },
  {
    question: 'Do chauffeurs wait during the event?',
    answer:
      'Waiting time or standby service can often be arranged, especially for weddings, dinners, concerts, sporting events, and airport pickups. The booking window should include any wait time needed.',
  },
  {
    question: 'What areas outside Toronto do you serve?',
    answer:
      'Service is available across the GTA and surrounding communities, including Mississauga, Brampton, Vaughan, Markham, Richmond Hill, Oakville, Burlington, Durham Region, Hamilton, and nearby areas by request.',
  },
  {
    question: 'Are the vehicles clean before pickup?',
    answer:
      'Vehicles are expected to be clean and presentation-ready before service. For weddings, proms, corporate travel, and VIP events, presentation details are especially important and should be discussed during booking.',
  },
  {
    question: 'What is your cancellation policy?',
    answer:
      'Cancellation rules depend on the vehicle, event date, deposit, and booking terms. Ask for the cancellation and refund details before confirming, especially for peak dates, weddings, proms, and large party buses.',
  },
  {
    question: 'Can I get a quote without knowing every detail yet?',
    answer:
      'Yes. You can submit approximate details to start. Final pricing may change once pickup time, passenger count, locations, vehicle preference, stops, and return-trip details are confirmed.',
  },
  {
    question: 'Do you offer transportation for concerts and sports games?',
    answer:
      'Yes. Limos and party buses are popular for Scotiabank Arena, Rogers Centre, Budweiser Stage, theatres, festivals, and sporting events. Share the venue, event time, pickup area, and return plan.',
  },
];

const gallery = [
  { src: '/assets/img/hero-limo-v2.jpg', label: 'Nightlife stretch limo arrival' },
  { src: '/assets/img/party-bus-interior-v2.jpg', label: 'Premium party bus interior' },
  { src: '/assets/img/wedding-limo-v2.jpg', label: 'Wedding limousine experience' },
  { src: '/assets/img/chauffeur-airport-v2.jpg', label: 'Corporate and airport service' },
];

const routeTitles: Record<string, string> = {
  '/': 'GTA Party Limos | Luxury Limo & Party Bus Rentals in Toronto',
  '/fleet': 'Fleet | GTA Party Limos',
  '/services': 'Services | GTA Party Limos',
  '/service-areas': 'Service Areas | GTA Party Limos',
  '/about': 'About | GTA Party Limos',
  '/gallery': 'Gallery | GTA Party Limos',
  '/reviews': 'Reviews | GTA Party Limos',
  '/faq': 'FAQ | GTA Party Limos',
  '/contact': 'Contact | GTA Party Limos',
  '/book-now': 'Book Now | GTA Party Limos',
  '/terms-conditions': 'Terms & Conditions | GTA Party Limos',
  '/privacy-policy': 'Privacy Policy | GTA Party Limos',
};

services.forEach((service) => {
  routeTitles[`/${service.slug}`] = `${service.title} | GTA Party Limos`;
});

const getAccessKey = () => window.GTA_PARTY_LIMOS_WEB3FORMS_ACCESS_KEY?.trim() ?? '';

const normalizePath = () => {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
};

const titleFromPath = (href: string) =>
  href
    .replace('/', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (character: string) => character.toUpperCase());

function App() {
  const [path, setPath] = useState(normalizePath);

  useEffect(() => {
    const onPop = () => setPath(normalizePath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = routeTitles[path] ?? 'GTA Party Limos';
    if (window.location.hash) {
      window.setTimeout(() => {
        document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [path]);

  const navigate = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('http')) return;
    event.preventDefault();
    const nextPath = href === '/' ? '/' : href.replace(/\/+$/, '');
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

  const service = services.find((item) => `/${item.slug}` === path);

  return (
    <>
      <Header navigate={navigate} activePath={path} />
      <main>
        {path === '/' && <HomePage navigate={navigate} />}
        {path === '/fleet' && <FleetPage navigate={navigate} />}
        {path === '/services' && <ServicesPage navigate={navigate} />}
        {service && <ServicePage service={service} navigate={navigate} />}
        {path === '/service-areas' && <ServiceAreasPage navigate={navigate} />}
        {path === '/about' && <AboutPage navigate={navigate} />}
        {path === '/gallery' && <GalleryPage navigate={navigate} />}
        {path === '/reviews' && <ReviewsPage navigate={navigate} />}
        {path === '/faq' && <FaqPage navigate={navigate} />}
        {path === '/contact' && <ContactPage navigate={navigate} />}
        {path === '/book-now' && <BookingPage />}
        {path === '/terms-conditions' && <TermsPage />}
        {path === '/privacy-policy' && <PrivacyPage />}
        {!routeTitles[path] && !service && <NotFoundPage navigate={navigate} />}
      </main>
      <Footer navigate={navigate} />
      <MobileCta navigate={navigate} />
    </>
  );
}

function Header({
  navigate,
  activePath,
}: {
  navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void;
  activePath: string;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const navLink = (href: string, label: string) => (
    <a className={activePath === href ? 'active' : ''} href={href} onClick={navigate(href)}>
      {label}
    </a>
  );

  return (
    <header className="site-header">
      <div className="top-strip">
        <div className="container strip-inner">
          <span>
            <Star aria-hidden="true" /> 4.9 Google rated limousine service
          </span>
          <span className="hide-sm">
            <MapPin aria-hidden="true" /> Toronto and GTA-wide coverage
          </span>
          <a href={contact.phoneHref}>
            <Phone aria-hidden="true" /> {contact.phone}
          </a>
        </div>
      </div>
      <div className="container nav-shell">
        <a className="brand" href="/" onClick={navigate('/')}>
          <BrandMark />
          <span>
            <strong>GTA Party Limos</strong>
            <small>Luxury transportation</small>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navLink('/', 'Home')}
          <div className="nav-dropdown">
            <button type="button">
              Fleet <ChevronDown aria-hidden="true" />
            </button>
            <div className="dropdown-panel compact">
              <a href="/fleet" onClick={navigate('/fleet')}>Fleet Overview</a>
              {fleet.map((item) => (
                <a key={item.slug} href="/fleet" onClick={navigate('/fleet')}>
                  {item.name}
                </a>
              ))}
            </div>
          </div>
          <div className="nav-dropdown">
            <button type="button">
              Services <ChevronDown aria-hidden="true" />
            </button>
            <div className="dropdown-panel">
              <a href="/services" onClick={navigate('/services')}>All Services</a>
              {services.map((service) => (
                <a key={service.slug} href={`/${service.slug}`} onClick={navigate(`/${service.slug}`)}>
                  {service.navTitle ?? service.title}
                </a>
              ))}
            </div>
          </div>
          <div className="nav-dropdown">
            <button type="button">
              Areas <ChevronDown aria-hidden="true" />
            </button>
            <div className="dropdown-panel areas">
              <a href="/service-areas" onClick={navigate('/service-areas')}>Service Areas</a>
              {areas.slice(0, 12).map((area) => (
                <a key={area} href="/service-areas" onClick={navigate('/service-areas')}>
                  {area}
                </a>
              ))}
            </div>
          </div>
          {navLink('/gallery', 'Gallery')}
          {navLink('/reviews', 'Reviews')}
          {navLink('/contact', 'Contact')}
        </nav>
        <div className="header-actions">
          <a className="icon-link" href={contact.phoneHref} aria-label="Call GTA Party Limos">
            <Phone aria-hidden="true" />
          </a>
          <a className="button primary small" href="/book-now" onClick={navigate('/book-now')}>
            Get Instant Quote
          </a>
          <button className="menu-button" type="button" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={`mobile-menu ${open ? 'open' : ''}`}>
        <div className="mobile-panel">
          <button className="close-button" type="button" onClick={close} aria-label="Close menu">
            <X aria-hidden="true" />
          </button>
          <a className="brand" href="/" onClick={(event) => { navigate('/')(event); close(); }}>
            <BrandMark />
            <span>
              <strong>GTA Party Limos</strong>
              <small>Luxury transportation</small>
            </span>
          </a>
          <div className="mobile-links">
            {['/', '/fleet', '/services', '/service-areas', '/gallery', '/reviews', '/faq', '/contact', '/book-now'].map((href) => (
              <a key={href} href={href} onClick={(event) => { navigate(href)(event); close(); }}>
                {href === '/' ? 'Home' : titleFromPath(href)}
              </a>
            ))}
          </div>
          <div className="mobile-service-list">
            {services.map((service) => (
              <a key={service.slug} href={`/${service.slug}`} onClick={(event) => { navigate(`/${service.slug}`)(event); close(); }}>
                {service.navTitle ?? service.title}
              </a>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function HomePage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <>
      <Hero navigate={navigate} />
      <TrustBar />
      <FleetPreview navigate={navigate} />
      <ServicesPreview navigate={navigate} />
      <WhyChoose />
      <FastBookingSection />
      <LuxuryExperience navigate={navigate} />
      <ChauffeurSection />
      <AreaSection navigate={navigate} />
      <GallerySlider navigate={navigate} />
      <Testimonials />
      <FaqPreview navigate={navigate} />
      <FinalCta navigate={navigate} />
    </>
  );
}

function FastBookingSection() {
  return (
    <section className="quote-band" id="quote">
      <div className="container quote-grid">
        <div>
          <p className="eyebrow">Fast booking</p>
          <h2>Request your limo quote in under a minute.</h2>
          <p>
            Send the event date, pickup details, passenger count, and preferred vehicle. We will help match the right
            limo or party bus for the occasion.
          </p>
          <div className="quote-highlights">
            <span><Clock3 aria-hidden="true" /> Fast responses</span>
            <span><ShieldCheck aria-hidden="true" /> Professional chauffeurs</span>
            <span><Route aria-hidden="true" /> Custom GTA routes</span>
          </div>
        </div>
        <QuickQuoteForm compact />
      </div>
    </section>
  );
}

function Hero({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const heroHighlights = [
    { icon: MapPin, label: 'GTA-wide coverage' },
    { icon: CarFront, label: 'Premium fleet' },
    { icon: ShieldCheck, label: 'Professional chauffeurs' },
    { icon: Clock3, label: 'Fast quotes' },
  ];

  return (
    <section className="hero">
      <div className="hero-bg" />
      <div className="hero-animation" aria-hidden="true">
        <span className="headlight one" />
        <span className="headlight two" />
        <span className="route-glow" />
        <span className="city-reflection" />
      </div>
      <div className="route-line one" />
      <div className="route-line two" />
      <div className="container hero-content">
        <div className="hero-copy">
          <span className="eyebrow"><Sparkles aria-hidden="true" /> Toronto luxury limo and party bus rentals</span>
          <h1>VIP limo rides for Toronto nights.</h1>
          <p>
            Premium limo, party limo, party bus, wedding, prom, airport, corporate, and VIP transportation across
            Toronto and the entire Greater Toronto Area.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/book-now" onClick={navigate('/book-now')}>
              Get Instant Quote <ArrowRight aria-hidden="true" />
            </a>
            <a className="button secondary" href="/fleet" onClick={navigate('/fleet')}>
              View Fleet
            </a>
          </div>
          <div className="hero-trust">
            {heroHighlights.map(({ icon: IconComponent, label }) => (
              <span key={label}><IconComponent aria-hidden="true" /> {label}</span>
            ))}
          </div>
        </div>
        <div className="hero-card">
          <div className="rating-card google-verified-card">
            <span><GoogleMark /> Google Verified</span>
            <strong>4.9</strong>
            <FiveStarRow />
          </div>
          <QuickQuoteForm compact />
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    { icon: Clock3, value: '24/7', label: 'Event and airport availability' },
    { icon: MapPin, value: '30+', label: 'GTA cities and suburbs served' },
    { icon: Star, value: '4.9', label: 'Google verified rating' },
    { icon: ShieldCheck, value: 'VIP', label: 'Wedding, prom, party and executive-ready' },
  ];
  return (
    <section className="trust-bar">
      <div className="container trust-grid">
        {items.map(({ icon: IconComponent, value, label }) => (
          <div key={label}>
            <span className="trust-icon"><IconComponent aria-hidden="true" /></span>
            <span className="trust-copy">
              <strong>{value}</strong>
              <span>{label}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FleetPreview({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setActive((current) => (current + 1) % fleet.length), 4600);
    return () => window.clearInterval(interval);
  }, []);

  const previous = () => setActive((current) => (current - 1 + fleet.length) % fleet.length);
  const next = () => setActive((current) => (current + 1) % fleet.length);

  return (
    <section className="section">
      <div className="container">
        <SectionIntro
          eyebrow="Fleet preview"
          title="Vehicles that feel polished before the door even opens."
          text="From elegant stretch limousines to party buses built for group energy, every quote starts with the right vehicle for your passenger count, occasion, and route."
        />
        <div className="fleet-carousel" aria-live="polite">
          <div className="fleet-carousel-window">
            <div className="fleet-carousel-track" style={{ transform: `translateX(-${active * 100}%)` }}>
              {fleet.map((item) => (
                <article className="fleet-slide" key={item.slug}>
                  <img src={item.image} alt={item.name} />
                  <div>
                    <span>{item.passengers}</span>
                    <h3>{item.name}</h3>
                    <p>{item.idealFor}</p>
                    <ul>
                      {item.features.map((feature) => (
                        <li key={feature}><Check aria-hidden="true" /> {feature}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="slider-controls">
            <div className="slider-dots">
              {fleet.map((item, index) => (
                <button key={item.slug} type="button" className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Show ${item.name}`} />
              ))}
            </div>
            <div className="slider-arrows">
              <button type="button" onClick={previous} aria-label="Previous fleet vehicle"><ChevronLeft aria-hidden="true" /></button>
              <button type="button" onClick={next} aria-label="Next fleet vehicle"><ChevronRight aria-hidden="true" /></button>
            </div>
          </div>
        </div>
        <SectionCta navigate={navigate} primary="/fleet" primaryText="Explore Fleet" secondary="/book-now" secondaryText="Get Vehicle Quote" />
      </div>
    </section>
  );
}

function ServicesPreview({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <section className="section section-dark">
      <div className="container">
        <SectionIntro
          eyebrow="Popular occasions"
          title="One booking flow for every celebration, transfer, and VIP route."
          text="Pick your occasion and tell us the basics. We will help with vehicle recommendations, timing, pickup details, and route planning."
          light
        />
        <div className="service-grid">
          {services.map((service) => {
            const IconComponent = service.icon;
            return (
              <a className="service-card" href={`/${service.slug}`} onClick={navigate(`/${service.slug}`)} key={service.slug}>
                <IconComponent aria-hidden="true" />
                <h3>{service.navTitle ?? service.title}</h3>
                <p>{service.summary}</p>
                <span>View service <ArrowRight aria-hidden="true" /></span>
              </a>
            );
          })}
        </div>
        <SectionCta navigate={navigate} primary="/services" primaryText="View All Services" secondary="/book-now" secondaryText="Book Your Limo" dark />
      </div>
    </section>
  );
}

function WhyChoose() {
  const items = [
    ['Quote-first booking', 'A quick form gathers the details needed to price the right vehicle and route without long back-and-forth.'],
    ['Premium arrival standard', 'Clean vehicles, polished chauffeurs, and calm timing make the ride feel like part of the event.'],
    ['Built for the GTA', 'We understand Toronto traffic, venue timing, airport windows, and multi-city pickup routes.'],
    ['Occasion-specific planning', 'Proms, weddings, birthdays, corporate trips, and nights out each get the details they need.'],
  ];
  return (
    <section className="section why">
      <div className="container split">
        <div>
          <p className="eyebrow">Why choose GTA Party Limos</p>
          <h2>Luxury service that still makes booking feel fast.</h2>
          <p>
            The best limo experience is equal parts vehicle, timing, communication, and atmosphere. GTA Party Limos is
            built to convert a quick request into a smooth, high-confidence booking.
          </p>
        </div>
        <div className="feature-list">
          {items.map(([title, text]) => (
            <div className="feature-row" key={title}>
              <BadgeCheck aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LuxuryExperience({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <section className="experience">
      <div className="container experience-grid">
        <img src="/assets/img/party-bus-interior-v2.jpg" alt="Luxury party bus interior with lounge seating" />
        <div>
          <p className="eyebrow">The luxury experience</p>
          <h2>Private lounge energy, black-car discipline.</h2>
          <p>
            Your ride should feel exciting without feeling chaotic. Expect atmospheric cabins, comfortable seating,
            polished routing, and a chauffeur who keeps the timeline quietly under control.
          </p>
          <div className="mini-grid">
            <span>LED ambience</span>
            <span>Premium audio</span>
            <span>Multi-stop routing</span>
            <span>Photo-ready arrivals</span>
          </div>
          <a className="button primary" href="/party-limos" onClick={navigate('/party-limos')}>
            Explore Party Limos
          </a>
        </div>
      </div>
    </section>
  );
}

function ChauffeurSection() {
  return (
    <section className="section">
      <div className="container chauffeur">
        <div>
          <p className="eyebrow">Professional chauffeurs</p>
          <h2>The vehicle gets attention. The driver earns trust.</h2>
          <p>
            Behind every smooth limo booking is a chauffeur who understands timing, curbside etiquette, passenger safety,
            and the small details that make a luxury ride feel natural.
          </p>
        </div>
        <img src="/assets/img/chauffeur-airport-v2.jpg" alt="Professional chauffeur airport limo service" />
      </div>
    </section>
  );
}

function AreaSection({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <section className="section area-section">
      <div className="container">
        <SectionIntro
          eyebrow="Toronto and GTA coverage"
          title="From downtown Toronto to every major GTA event route."
          text="Whether the pickup is a condo, hotel, banquet hall, airport terminal, restaurant, school, office, or private residence, we help build the right route."
        />
        <div className="area-tags">
          {areas.map((area) => <span key={area}>{area}</span>)}
        </div>
        <SectionCta navigate={navigate} primary="/service-areas" primaryText="See Service Areas" secondary="/book-now" secondaryText="Check Availability" />
      </div>
    </section>
  );
}

function GallerySlider({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setActive((current) => (current + 1) % gallery.length), 4800);
    return () => window.clearInterval(interval);
  }, []);

  const previous = () => setActive((current) => (current - 1 + gallery.length) % gallery.length);
  const next = () => setActive((current) => (current + 1) % gallery.length);

  return (
    <section className="section gallery-section" id="gallery-preview">
      <div className="container">
        <SectionIntro
          eyebrow="Gallery"
          title="A visual preview of the ride."
          text="Premium limousine, party bus, wedding, and black-car experiences for high-impact arrivals and polished group transportation."
        />
        <div className="gallery-carousel" aria-live="polite">
          <div className="gallery-carousel-window">
            <div className="gallery-carousel-track" style={{ transform: `translateX(-${active * 100}%)` }}>
              {gallery.map((item) => (
                <figure key={item.label}>
                  <img src={item.src} alt={item.label} />
                  <figcaption>{item.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
          <div className="slider-controls">
            <div className="slider-dots">
              {gallery.map((item, index) => (
                <button key={item.label} type="button" className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Show ${item.label}`} />
              ))}
            </div>
            <div className="slider-arrows">
              <button type="button" onClick={previous} aria-label="Previous gallery image"><ChevronLeft aria-hidden="true" /></button>
              <button type="button" onClick={next} aria-label="Next gallery image"><ChevronRight aria-hidden="true" /></button>
            </div>
          </div>
        </div>
        <SectionCta navigate={navigate} primary="/gallery" primaryText="Open Gallery" secondary="/book-now" secondaryText="Book This Look" />
      </div>
    </section>
  );
}

function Testimonials() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setIndex((current) => (current + 1) % testimonials.length), 4200);
    return () => window.clearInterval(interval);
  }, []);

  const activeReview = useMemo(() => testimonials[index], [index]);
  const previous = () => setIndex((current) => (current - 1 + testimonials.length) % testimonials.length);
  const next = () => setIndex((current) => (current + 1) % testimonials.length);

  return (
    <section className="section testimonial-section" id="testimonials">
      <div className="container testimonial-container">
        <div className="google-heading">
          <div>
            <p className="google-verified-title"><GoogleMark /> Google Verified Testimonials</p>
            <h2>Guests remember the ride for the right reasons.</h2>
            <div className="google-rating-badge">
              <strong>4.9</strong>
              <FiveStarRow />
              <small>based on recent Google reviews</small>
            </div>
          </div>
        </div>
        <div className="review-carousel" aria-live="polite">
          <article className="testimonial-card featured-review" key={activeReview.name}>
            <FiveStarRow />
            <p>"{activeReview.text}"</p>
            <div className="review-card-bottom">
              <span className="review-avatar">{activeReview.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
              <span className="review-person">
                <strong>{activeReview.name}</strong>
                <small>{activeReview.occasion}</small>
              </span>
              <span className="verified-badge"><GoogleMark /> Google Verified</span>
            </div>
          </article>
          <div className="slider-controls review-controls">
            <div className="slider-dots">
              {testimonials.map((review, reviewIndex) => (
                <button key={review.name} type="button" className={reviewIndex === index ? 'active' : ''} onClick={() => setIndex(reviewIndex)} aria-label={`Show review from ${review.name}`} />
              ))}
            </div>
            <div className="slider-arrows">
              <button type="button" onClick={previous} aria-label="Previous review"><ChevronLeft aria-hidden="true" /></button>
              <button type="button" onClick={next} aria-label="Next review"><ChevronRight aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FaqPreview({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <section className="section">
      <div className="container faq-preview">
        <SectionIntro
          eyebrow="Quick answers"
          title="Limo booking questions, answered before you call."
          text="Here are the details most guests want to confirm before submitting a quote request."
        />
        <div className="faq-grid">
          {faqs.slice(0, 4).map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
        <SectionCta navigate={navigate} primary="/faq" primaryText="Read FAQ" secondary="/book-now" secondaryText="Start Booking" />
      </div>
    </section>
  );
}

function FinalCta({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <section className="final-cta">
      <div className="container final-panel">
        <p className="eyebrow">Ready when your date is</p>
        <h2>Tell us the occasion. We will help line up the ride.</h2>
        <p>Get a fast quote for limo rentals, party limos, party buses, weddings, proms, airport transfers, corporate travel, and VIP nights out.</p>
        <div className="hero-actions">
          <a className="button primary" href="/book-now" onClick={navigate('/book-now')}>
            Get Instant Quote
          </a>
          <a className="button secondary" href={contact.phoneHref}>
            Call Now
          </a>
        </div>
      </div>
    </section>
  );
}

function FleetPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell
      eyebrow="Fleet"
      title="Premium limo and party bus options for every route."
      text="Choose the vehicle style that fits the passenger count, occasion, and atmosphere. We confirm final recommendations after reviewing your date and itinerary."
    >
      <div className="fleet-page-grid">
        {fleet.map((item) => (
          <article className="fleet-detail-card" key={item.slug}>
            <img src={item.image} alt={item.name} />
            <div>
              <span>{item.passengers}</span>
              <h2>{item.name}</h2>
              <p>{item.idealFor}</p>
              <ul>
                {item.features.map((feature) => <li key={feature}><Check aria-hidden="true" /> {feature}</li>)}
              </ul>
              <a className="button primary" href="/book-now" onClick={navigate('/book-now')}>Quote This Vehicle</a>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

function ServicesPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell
      eyebrow="Services"
      title="Luxury transportation for the GTA's best moments."
      text="Every service page is built around fast quote requests, practical route details, and a premium guest experience from pickup to final drop-off."
    >
      <div className="service-page-grid">
        {services.map((service) => {
          const IconComponent = service.icon;
          return (
            <article className="service-detail-card" key={service.slug}>
              <img src={service.image} alt={service.title} />
              <div>
                <IconComponent aria-hidden="true" />
                <p className="eyebrow">{service.eyebrow}</p>
                <h2>{service.title}</h2>
                <p>{service.summary}</p>
                <a className="text-link" href={`/${service.slug}`} onClick={navigate(`/${service.slug}`)}>
                  Learn more <ArrowRight aria-hidden="true" />
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </PageShell>
  );
}

function ServicePage({
  service,
  navigate,
}: {
  service: Service;
  navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const IconComponent = service.icon;
  return (
    <>
      <section className="service-hero">
        <img src={service.image} alt={service.title} />
        <div className="container service-hero-content">
          <div>
            <p className="eyebrow"><IconComponent aria-hidden="true" /> {service.eyebrow}</p>
            <h1>{service.title} in Toronto and the GTA</h1>
            <p>{service.summary}</p>
            <div className="hero-actions">
              <a className="button primary" href="/book-now" onClick={navigate('/book-now')}>Get Instant Quote</a>
              <a className="button secondary" href={contact.phoneHref}>Call Now</a>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container service-body">
          <div>
            <h2>Built around your itinerary.</h2>
            <p>{service.detail}</p>
            <p>{service.proof}</p>
          </div>
          <div className="inclusion-card">
            <h3>Popular inclusions</h3>
            {service.inclusions.map((item) => (
              <span key={item}><Check aria-hidden="true" /> {item}</span>
            ))}
          </div>
        </div>
      </section>
      <section className="quote-band">
        <div className="container quote-grid">
          <div>
            <p className="eyebrow">Check availability</p>
            <h2>Get a quote for {service.title.toLowerCase()}.</h2>
            <p>Share the date, passenger count, pickup details, and any stops. We will help match the right vehicle and timing.</p>
          </div>
          <QuickQuoteForm compact defaultEvent={service.title} />
        </div>
      </section>
      <FinalCta navigate={navigate} />
    </>
  );
}

function ServiceAreasPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell
      eyebrow="Service areas"
      title="Luxury limo service across Toronto and the Greater Toronto Area."
      text="We support point-to-point rides, hourly bookings, multi-stop event routes, airport transfers, weddings, proms, and VIP nights across the region."
    >
      <div className="area-page-grid">
        {areas.map((area) => (
          <article key={area}>
            <MapPin aria-hidden="true" />
            <h2>{area}</h2>
            <p>Premium limo, party bus, airport, event, and celebration transportation serving {area} and nearby communities.</p>
          </article>
        ))}
      </div>
      <SectionCta navigate={navigate} primary="/book-now" primaryText="Check Your Area" secondary="/contact" secondaryText="Contact Us" />
    </PageShell>
  );
}

function AboutPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell
      eyebrow="About GTA Party Limos"
      title="A premium lead-generation experience for luxury GTA transportation."
      text="GTA Party Limos helps guests quickly connect with high-quality limousine, party bus, wedding, prom, corporate, airport, and event transportation across Toronto and the GTA."
    >
      <div className="about-grid">
        <img src="/assets/img/hero-limo-v2.jpg" alt="Luxury limousine in Toronto at night" />
        <div>
          <h2>Designed for fast decisions and elevated expectations.</h2>
          <p>
            People booking a limo are often planning a major moment. They need confidence quickly: a polished vehicle,
            a clear quote path, responsive communication, and service that feels appropriate for the occasion.
          </p>
          <p>
            This website is built around that expectation, with quick quote forms, service-specific content, premium
            imagery, and trust cues throughout the booking journey.
          </p>
          <a className="button primary" href="/book-now" onClick={navigate('/book-now')}>Request a Quote</a>
        </div>
      </div>
    </PageShell>
  );
}

function GalleryPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell
      eyebrow="Gallery"
      title="Premium visuals for premium arrivals."
      text="Preview the GTA Party Limos atmosphere: dark luxury, champagne highlights, clean vehicles, celebration cabins, and professional chauffeur service."
    >
      <div className="gallery-page-grid">
        {gallery.concat(gallery).map((item, index) => (
          <figure key={`${item.label}-${index}`}>
            <img src={item.src} alt={item.label} />
            <figcaption>{item.label}</figcaption>
          </figure>
        ))}
      </div>
      <SectionCta navigate={navigate} primary="/book-now" primaryText="Book Your Limo" secondary="/fleet" secondaryText="View Fleet" />
    </PageShell>
  );
}

function ReviewsPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell
      eyebrow="Reviews"
      title="Google verified testimonials from limo guests."
      text="Launch-ready review content focused on punctuality, clean vehicles, professional chauffeurs, weddings, proms, nights out, and airport travel."
    >
      <Testimonials />
      <SectionCta navigate={navigate} primary="/book-now" primaryText="Join the Happy Guests" secondary="/contact" secondaryText="Ask a Question" />
    </PageShell>
  );
}

function FaqPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell
      eyebrow="FAQ"
      title="Answers before you book."
      text="The fastest path to a reliable quote is sharing your date, route, passenger count, and vehicle preference. These answers cover the common booking details."
    >
      <div className="faq-grid full">
        {faqs.map((item) => (
          <details key={item.question} open={item.question === faqs[0].question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
      <SectionCta navigate={navigate} primary="/book-now" primaryText="Get Instant Quote" secondary={contact.phoneHref} secondaryText="Call Now" />
    </PageShell>
  );
}

function ContactPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell
      eyebrow="Contact"
      title="Talk to GTA Party Limos."
      text="Ask a question, check date availability, or send the details for a custom itinerary. For urgent same-day transportation, call now."
    >
      <div className="contact-grid">
        <div className="contact-card">
          <h2>Contact details</h2>
          <a href={contact.phoneHref}><Phone aria-hidden="true" /> {contact.phone}</a>
          <a href={contact.emailHref}><Mail aria-hidden="true" /> {contact.email}</a>
          <span><MapPin aria-hidden="true" /> Toronto and the Greater Toronto Area</span>
          <a className="button primary" href="/book-now" onClick={navigate('/book-now')}>Use Full Booking Form</a>
        </div>
        <ContactForm />
      </div>
    </PageShell>
  );
}

function BookingPage() {
  return (
    <PageShell
      eyebrow="Book now"
      title="Get your limo quote."
      text="Send the details below and GTA Party Limos will respond with availability, vehicle recommendations, and next steps for your booking."
    >
      <div className="booking-layout">
        <BookingForm />
        <aside className="booking-aside">
          <h2>Helpful quote details</h2>
          <p>Exact pickup time, passenger count, pickup and drop-off locations, and any extra stops help us quote faster.</p>
          <div className="feature-row compact"><CalendarCheck aria-hidden="true" /><span>Wedding, prom, party, corporate, and airport service</span></div>
          <div className="feature-row compact"><Luggage aria-hidden="true" /><span>Luggage and passenger-count planning</span></div>
          <div className="feature-row compact"><MessageCircle aria-hidden="true" /><span>Fast follow-up for urgent bookings</span></div>
        </aside>
      </div>
    </PageShell>
  );
}

function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Privacy policy"
      title="Privacy Policy"
      text="This Privacy Policy explains how GTA Party Limos collects, uses, protects, and manages personal information submitted through this website."
    >
      <div className="policy-content">
        <p>Last updated: July 4, 2026</p>
        <h2>Information We Collect</h2>
        <p>When you request a quote, book transportation, or contact us, we may collect your name, phone number, email address, event type, pickup date and time, pickup and drop-off locations, itinerary, passenger count, vehicle preference, occasion, and message details.</p>
        <h2>How We Use Information</h2>
        <p>We use this information to respond to inquiries, confirm availability, prepare quotes, recommend vehicles, coordinate booking details, provide customer support, improve website performance, and maintain business records.</p>
        <h2>Consent and Limiting Use</h2>
        <p>By submitting a website form, you consent to being contacted about your request. We aim to collect only the information reasonably needed for the purposes identified at or before collection.</p>
        <h2>Service Providers</h2>
        <p>Website form submissions are processed through Web3Forms. We may also use hosting, analytics, email, phone, scheduling, or customer-service providers where needed to operate the website and respond to requests.</p>
        <h2>Safeguards and Retention</h2>
        <p>We use reasonable administrative, technical, and organizational safeguards to protect submitted information. We retain information only as long as reasonably necessary for booking, customer service, legal, accounting, and business purposes.</p>
        <h2>Access and Correction</h2>
        <p>You may request access to, correction of, or deletion of your personal information, subject to legal and operational limits. To make a request, contact us using the email address below.</p>
        <h2>Cookies and Analytics</h2>
        <p>This website may use basic cookies, analytics, or similar technologies to understand site performance and improve user experience. You can adjust browser settings to limit cookies.</p>
        <h2>External Links</h2>
        <p>This website may link to phone, email, map, review, payment, or third-party service platforms. Those platforms have their own privacy practices and terms.</p>
        <h2>Contact</h2>
        <p>Privacy questions can be sent to {contact.email}.</p>
      </div>
    </PageShell>
  );
}

function TermsPage() {
  return (
    <PageShell
      eyebrow="Legal"
      title="Terms & Conditions"
      text="These Terms & Conditions set out general rules for using the GTA Party Limos website and requesting transportation quotes or bookings."
    >
      <div className="policy-content">
        <p>Last updated: July 4, 2026</p>
        <h2>Website Use</h2>
        <p>This website is provided for general information and lead-generation purposes for limousine, party bus, airport, corporate, wedding, prom, and event transportation in Ontario, Canada. By using this website, you agree to these Terms & Conditions.</p>
        <h2>Quotes and Availability</h2>
        <p>Submitting a form does not create a confirmed booking. Vehicle availability, pricing, pickup times, route details, deposits, payment terms, and final booking conditions must be confirmed directly by GTA Party Limos or its transportation partners.</p>
        <h2>Customer Responsibilities</h2>
        <p>You are responsible for providing accurate contact information, pickup details, passenger counts, event timing, itinerary details, and any special requirements. Changes to route, timing, passenger count, or vehicle preference may affect pricing and availability.</p>
        <h2>Deposits, Payments, and Cancellations</h2>
        <p>Deposits, payment deadlines, refunds, cancellations, wait-time fees, cleaning fees, damage fees, overtime charges, and no-show rules will be explained during booking confirmation where applicable. Do not submit payment information through general website forms.</p>
        <h2>Passenger Conduct</h2>
        <p>Passengers must follow all applicable laws and reasonable chauffeur instructions. Unsafe, unlawful, abusive, or damaging conduct may result in refusal or termination of service without refund, subject to the confirmed booking terms.</p>
        <h2>Alcohol, Minors, and Legal Compliance</h2>
        <p>Customers and passengers are responsible for complying with Ontario and Canadian laws, including laws related to alcohol, cannabis, seatbelts, minors, public conduct, and property damage. Proms and youth events may require adult or parent/guardian coordination.</p>
        <h2>Website Content</h2>
        <p>Website content, vehicle descriptions, photos, service summaries, and testimonials are provided for general informational and marketing purposes. Fleet details and features may vary by vehicle and booking date.</p>
        <h2>Limitation of Liability</h2>
        <p>To the fullest extent permitted by law, GTA Party Limos is not liable for indirect, incidental, consequential, or punitive damages arising from website use, quote requests, third-party links, or service interruptions. Nothing in these Terms limits rights that cannot be limited under applicable Ontario or Canadian law.</p>
        <h2>Governing Law</h2>
        <p>These Terms are governed by the laws of Ontario and the applicable federal laws of Canada. Any dispute will be handled in Ontario unless applicable law requires otherwise.</p>
        <h2>Changes to These Terms</h2>
        <p>We may update these Terms from time to time. Continued use of the website after changes are posted means you accept the updated Terms.</p>
        <h2>Contact</h2>
        <p>Questions about these Terms can be sent to {contact.email}.</p>
      </div>
    </PageShell>
  );
}

function SolidStar() {
  return <Star className="solid-star" aria-hidden="true" />;
}

function FiveStarRow() {
  return (
    <span className="five-stars" aria-label="5 star review">
      <SolidStar />
      <SolidStar />
      <SolidStar />
      <SolidStar />
      <SolidStar />
    </span>
  );
}

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.46c-.28 1.5-1.12 2.77-2.39 3.62v2.95h3.87c2.26-2.08 3.56-5.15 3.56-8.59Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-2.95c-1.07.72-2.44 1.14-4.07 1.14-3.13 0-5.78-2.11-6.72-4.95H1.29v3.04A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.33A7.21 7.21 0 0 1 4.9 12c0-.81.14-1.6.38-2.33V6.63H1.29A12 12 0 0 0 0 12c0 1.93.46 3.76 1.29 5.37l3.99-3.04Z" />
      <path fill="#EA4335" d="M12 4.72c1.76 0 3.34.6 4.59 1.79l3.43-3.43A11.48 11.48 0 0 0 12 0 12 12 0 0 0 1.29 6.63l3.99 3.04C6.22 6.83 8.87 4.72 12 4.72Z" />
    </svg>
  );
}

function BrandMark() {
  const id = useId().replace(/:/g, '');
  const compassGlow = `${id}-compass-glow`;

  return (
    <span className="brand-mark" aria-hidden="true">
      <svg className="brand-icon-mark" viewBox="0 0 64 64">
        <defs>
          <radialGradient id={compassGlow} cx="50%" cy="48%" r="44%">
            <stop offset="0" stopColor="#fff0b8" stopOpacity="0.32" />
            <stop offset="0.52" stopColor="#d8b56d" stopOpacity="0.12" />
            <stop offset="1" stopColor="#d8b56d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="22" fill={`url(#${compassGlow})`} />
        <circle cx="32" cy="32" r="19" fill="none" stroke="#11100d" strokeWidth="4.4" />
        <circle cx="32" cy="32" r="12" fill="none" stroke="#11100d" strokeOpacity="0.18" strokeWidth="2" />
        <path d="M32 14.5l6 17.5 17.5 6-17.5 6-6 17.5-6-17.5-17.5-6 17.5-6 6-17.5Z" fill="#11100d" />
        <path d="M32 22.5l3.1 9.5 9.4 3.1-9.4 3.2-3.1 9.2-3.1-9.2-9.4-3.2 9.4-3.1 3.1-9.5Z" fill="#d8b56d" opacity="0.5" />
        <circle cx="32" cy="32" r="3.2" fill="#fff0b8" opacity="0.68" />
      </svg>
    </span>
  );
}

function NotFoundPage({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <PageShell eyebrow="404" title="That route is not parked here." text="The page could not be found. Head back to the homepage or start a quote request.">
      <SectionCta navigate={navigate} primary="/" primaryText="Back Home" secondary="/book-now" secondaryText="Get Quote" />
    </PageShell>
  );
}

function PageShell({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
      </section>
      <section className="section page-content">
        <div className="container">{children}</div>
      </section>
    </>
  );
}

function SectionIntro({ eyebrow, title, text, light = false }: { eyebrow: string; title: string; text: string; light?: boolean }) {
  return (
    <div className={`section-intro ${light ? 'light' : ''}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function SectionCta({
  navigate,
  primary,
  primaryText,
  secondary,
  secondaryText,
  dark = false,
}: {
  navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void;
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  dark?: boolean;
}) {
  return (
    <div className={`section-cta ${dark ? 'dark' : ''}`}>
      <a className="button primary" href={primary} onClick={navigate(primary)}>{primaryText}</a>
      <a className="button secondary" href={secondary} onClick={navigate(secondary)}>{secondaryText}</a>
    </div>
  );
}

function FormStatus({ status }: { status: 'idle' | 'loading' | 'success' | 'error' }) {
  if (status === 'idle') return null;
  if (status === 'loading') return <p className="form-status">Sending your request...</p>;
  if (status === 'success') return <p className="form-status success">Thank you. Your request was sent successfully.</p>;
  return <p className="form-status error">Something went wrong. Please call us or try again.</p>;
}

function useWeb3Form(subject: string) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('loading');
    await populateDistanceFields(form);
    const formData = new FormData(form);
    formData.append('access_key', getAccessKey());
    formData.append('subject', subject);
    formData.append('from_name', String(formData.get('name') || 'GTA Party Limos Website'));
    formData.append('replyto', String(formData.get('email') || ''));

    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, { method: 'POST', body: formData });
      const data = (await response.json()) as { success?: boolean };
      if (!response.ok || !data.success) throw new Error('Form failed');
      setStatus('success');
      form.reset();
    } catch {
      setStatus('error');
    }
  };

  return { status, submit };
}

function QuickQuoteForm({ compact = false, defaultEvent = '' }: { compact?: boolean; defaultEvent?: string }) {
  const { status, submit } = useWeb3Form('GTA Party Limos - Quick Quote Request');
  const [returnTripRequired, setReturnTripRequired] = useState('');
  const pickupRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const returnAddressRef = useRef<HTMLInputElement>(null);

  usePlacesAutocomplete(pickupRef);
  usePlacesAutocomplete(destinationRef);
  usePlacesAutocomplete(returnAddressRef, returnTripRequired === 'Yes');

  const adjustPassengers = (event: React.MouseEvent<HTMLButtonElement>, delta: number) => {
    const input = event.currentTarget.closest('.number-stepper')?.querySelector<HTMLInputElement>('input');
    if (!input) return;
    if (delta > 0) {
      input.stepUp();
    } else {
      input.stepDown();
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  return (
    <form className={`quote-form ${compact ? 'compact' : ''}`} onSubmit={submit} onReset={() => setReturnTripRequired('')}>
      <input type="checkbox" name="botcheck" className="hidden" tabIndex={-1} autoComplete="off" />
      <input type="hidden" name="estimated_outbound_distance" />
      <input type="hidden" name="estimated_return_distance" />
      <input type="hidden" name="estimated_total_distance" />
      <input type="hidden" name="estimated_distance_note" />
      <div className="form-row two">
        <label>Name<input name="name" required placeholder="Your name" /></label>
        <label>Phone<input name="phone" required placeholder="Phone number" /></label>
      </div>
      <div className="form-row two">
        <label>Email<input type="email" name="email" required placeholder="Email address" /></label>
        <label>Event type
          <select name="event_type" required defaultValue={defaultEvent}>
            <option value="">Select event</option>
            {services.map((service) => <option key={service.slug}>{service.title}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row two">
        <label className="passenger-label">Passengers
          <span className="number-stepper">
            <input className="passenger-input" type="number" name="passengers" min="1" inputMode="numeric" placeholder="Guest count" />
            <span className="stepper-buttons">
              <button type="button" aria-label="Increase passengers" onClick={(event) => adjustPassengers(event, 1)} />
              <button type="button" aria-label="Decrease passengers" onClick={(event) => adjustPassengers(event, -1)} />
            </span>
          </span>
        </label>
        <label>Vehicle preference
          <select name="vehicle_preference" defaultValue="">
            <option value="">No preference yet</option>
            {fleet.map((item) => <option key={item.slug}>{item.name}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row two">
        <label>Pickup date<input type="date" name="pickup_date" required /></label>
        <label>Pickup time<input type="time" name="pickup_time" required /></label>
      </div>
      <div className="form-row two">
        <label>Pickup location<input ref={pickupRef} name="pickup_location" autoComplete="street-address" placeholder="Address, venue, hotel, or airport" /></label>
        <label>Drop-off location<input ref={destinationRef} name="dropoff_location" autoComplete="street-address" placeholder="Drop-off address, venue, or airport" /></label>
      </div>
      <div className="form-row two">
        <label>Service duration
          <select name="service_duration" required defaultValue="">
            <option value="">Hours needed</option>
            {Array.from({ length: 24 }, (_, index) => index + 1).map((hours) => (
              <option key={hours}>{hours} {hours === 1 ? 'hour' : 'hours'}</option>
            ))}
            <option>24+ hours</option>
            <option>Not sure yet</option>
          </select>
        </label>
        <label>Return trip required
          <select name="return_trip_required" required value={returnTripRequired} onChange={(event) => setReturnTripRequired(event.target.value)}>
            <option value="">Select option</option>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </label>
      </div>
      {returnTripRequired === 'Yes' && (
        <>
          <div className="form-row two">
            <label>Return pickup date<input type="date" name="return_pickup_date" required /></label>
            <label>Return pickup time<input type="time" name="return_pickup_time" required /></label>
          </div>
          <div className="form-row two">
            <label>Return pickup address<input ref={returnAddressRef} name="return_address" required autoComplete="street-address" placeholder="Return pickup address or final destination" /></label>
            <label>Driver standby needed
              <select name="driver_standby_required" required defaultValue="">
                <option value="">Select option</option>
                <option>No - scheduled return pickup only</option>
                <option>Yes - keep driver and vehicle on standby</option>
                <option>Not sure yet</option>
              </select>
            </label>
          </div>
        </>
      )}
      {!compact && <label>Message<textarea name="message" placeholder="Anything else we should know?" /></label>}
      <label className="consent">
        <input type="checkbox" name="consent" required />
        <span>I agree to be contacted about my limo quote request.</span>
      </label>
      <button className="button primary form-button" type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Sending...' : 'Get Instant Quote'}
      </button>
      <FormStatus status={status} />
    </form>
  );
}

function BookingForm() {
  const { status, submit } = useWeb3Form('GTA Party Limos - Full Booking Request');
  const [returnTripRequired, setReturnTripRequired] = useState('');
  const pickupRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const returnAddressRef = useRef<HTMLInputElement>(null);

  usePlacesAutocomplete(pickupRef);
  usePlacesAutocomplete(destinationRef);
  usePlacesAutocomplete(returnAddressRef, returnTripRequired === 'Yes');

  return (
    <form className="quote-form full-form" onSubmit={submit} onReset={() => setReturnTripRequired('')}>
      <input type="checkbox" name="botcheck" className="hidden" tabIndex={-1} autoComplete="off" />
      <input type="hidden" name="estimated_outbound_distance" />
      <input type="hidden" name="estimated_return_distance" />
      <input type="hidden" name="estimated_total_distance" />
      <input type="hidden" name="estimated_distance_note" />
      <div className="form-row two">
        <label>Name<input name="name" required placeholder="Your name" /></label>
        <label>Phone<input name="phone" required placeholder="Phone number" /></label>
      </div>
      <div className="form-row two">
        <label>Email<input type="email" name="email" required placeholder="Email address" /></label>
        <label>Event type<select name="event_type" required defaultValue=""><option value="">Select event</option>{services.map((service) => <option key={service.slug}>{service.title}</option>)}</select></label>
      </div>
      <div className="form-row two">
        <label>Number of passengers<input name="passengers" type="number" min="1" required inputMode="numeric" placeholder="Example: 12" /></label>
        <label>Vehicle preference<select name="vehicle_preference" defaultValue=""><option value="">No preference yet</option>{fleet.map((item) => <option key={item.slug}>{item.name}</option>)}</select></label>
      </div>
      <div className="form-row two">
        <label>Pickup date<input type="date" name="pickup_date" required /></label>
        <label>Pickup time<input type="time" name="pickup_time" required /></label>
      </div>
      <div className="form-row two">
        <label>Pickup location<input ref={pickupRef} name="pickup_location" required autoComplete="street-address" placeholder="Address, venue, hotel, airport, or city" /></label>
        <label>Drop-off location<input ref={destinationRef} name="dropoff_location" required autoComplete="street-address" placeholder="Drop-off address, venue, airport, or city" /></label>
      </div>
      <div className="form-row two">
        <label>Service duration
          <select name="service_duration" required defaultValue="">
            <option value="">Hours needed</option>
            {Array.from({ length: 24 }, (_, index) => index + 1).map((hours) => (
              <option key={hours}>{hours} {hours === 1 ? 'hour' : 'hours'}</option>
            ))}
            <option>24+ hours</option>
            <option>Not sure yet</option>
          </select>
        </label>
        <label>Return trip required
          <select name="return_trip_required" required value={returnTripRequired} onChange={(event) => setReturnTripRequired(event.target.value)}>
            <option value="">Select option</option>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </label>
      </div>
      {returnTripRequired === 'Yes' && (
        <>
          <div className="form-row two">
            <label>Return pickup date<input type="date" name="return_pickup_date" required /></label>
            <label>Return pickup time<input type="time" name="return_pickup_time" required /></label>
          </div>
          <div className="form-row two">
            <label>Return pickup address<input ref={returnAddressRef} name="return_address" required autoComplete="street-address" placeholder="Return pickup address or final destination" /></label>
            <label>Driver standby needed
              <select name="driver_standby_required" required defaultValue="">
                <option value="">Select option</option>
                <option>No - scheduled return pickup only</option>
                <option>Yes - keep driver and vehicle on standby</option>
                <option>Not sure yet</option>
              </select>
            </label>
          </div>
        </>
      )}
      <label>Occasion<input name="occasion" placeholder="Wedding, prom, birthday, airport, etc." /></label>
      <label>Message<textarea name="message" placeholder="Anything else we should know?" /></label>
      <label className="consent">
        <input type="checkbox" name="consent" required />
        <span>I agree to be contacted about my booking request and understand this form does not guarantee availability until confirmed.</span>
      </label>
      <button className="button primary form-button" type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Sending...' : 'Send Booking Request'}</button>
      <FormStatus status={status} />
    </form>
  );
}

function ContactForm() {
  const { status, submit } = useWeb3Form('GTA Party Limos - Contact Form');
  return (
    <form className="quote-form full-form" onSubmit={submit}>
      <input type="checkbox" name="botcheck" className="hidden" tabIndex={-1} autoComplete="off" />
      <div className="form-row two">
        <label>Name<input name="name" required placeholder="Your name" /></label>
        <label>Phone<input name="phone" required placeholder="Phone number" /></label>
      </div>
      <label>Email<input type="email" name="email" required placeholder="Email address" /></label>
      <label>Message<textarea name="message" required placeholder="How can we help?" /></label>
      <label className="consent">
        <input type="checkbox" name="consent" required />
        <span>I agree to be contacted about my request.</span>
      </label>
      <button className="button primary form-button" type="submit" disabled={status === 'loading'}>{status === 'loading' ? 'Sending...' : 'Send Message'}</button>
      <FormStatus status={status} />
    </form>
  );
}

function Footer({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <a className="brand" href="/" onClick={navigate('/')}>
            <BrandMark />
            <span>
              <strong>GTA Party Limos</strong>
              <small>Luxury transportation</small>
            </span>
          </a>
          <p>Premium limo, party limo, party bus, wedding, prom, corporate, airport, and VIP transportation lead-generation across Toronto and the GTA.</p>
        </div>
        <div>
          <h3>Services</h3>
          {services.slice(0, 6).map((service) => <a key={service.slug} href={`/${service.slug}`} onClick={navigate(`/${service.slug}`)}>{service.navTitle ?? service.title}</a>)}
        </div>
        <div>
          <h3>Company</h3>
          {['/fleet', '/service-areas', '/about', '/gallery', '/reviews', '/faq', '/contact'].map((href) => (
            <a key={href} href={href} onClick={navigate(href)}>{titleFromPath(href)}</a>
          ))}
        </div>
        <div>
          <h3>Legal</h3>
          <a href="/terms-conditions" onClick={navigate('/terms-conditions')}>Terms & Conditions</a>
          <a href="/privacy-policy" onClick={navigate('/privacy-policy')}>Privacy Policy</a>
        </div>
        <div>
          <h3>Book</h3>
          <a href={contact.phoneHref}>{contact.phone}</a>
          <a href={contact.emailHref}>{contact.email}</a>
          <a className="button primary" href="/book-now" onClick={navigate('/book-now')}>Get Instant Quote</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>Copyright (c) {new Date().getFullYear()} GTA Party Limos. All rights reserved.</span>
        <span>Powered by: <a href="https://servquik.com" target="_blank" rel="noreferrer">ServQuik Technologies</a></span>
      </div>
    </footer>
  );
}

function MobileCta({ navigate }: { navigate: (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <div className="mobile-cta">
      <a href={contact.phoneHref}><Phone aria-hidden="true" /> Call</a>
      <a href="/book-now" onClick={navigate('/book-now')}><CalendarCheck aria-hidden="true" /> Quote</a>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
