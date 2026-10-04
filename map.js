const locateButton = document.querySelector('#locate-button');
const locationStatus = document.querySelector('#location-status');
const map = document.querySelector('#restaurant-map');
const tiles = document.querySelector('#map-tiles');
const markers = document.querySelector('#map-markers');

export const mapState = {
    userPosition: null,
    nearestRestaurantId: null,
};

let currentRestaurants = [];
let getAllRestaurants = () => [];
let openRestaurant = () => {};
let nearestChanged = () => {};
let resizeTimer;

export const getCoordinates = (restaurant) => {
    const [longitude, latitude] = restaurant?.location?.coordinates || [];
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;
    return {latitude: Number(latitude), longitude: Number(longitude)};
};

export const distanceInKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => value * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const worldX = (longitude, zoom) => (longitude + 180) / 360 * 256 * 2 ** zoom;

const worldY = (latitude, zoom) => {
    const lat = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180;
    return (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * 256 * 2 ** zoom;
};

const getZoom = (points) => {
    if (points.length <= 1) return 12;

    const lats = points.map((point) => point.latitude);
    const lons = points.map((point) => point.longitude);
    const range = Math.max(
        Math.max(...lats) - Math.min(...lats),
        Math.max(...lons) - Math.min(...lons)
    );

    if (range < 0.05) return 13;
    if (range < 0.12) return 11;
    if (range < 0.4) return 9;
    if (range < 1) return 8;
    if (range < 3) return 7;
    return 5;
};

const drawTiles = (zoom, left, top, width, height) => {
    const size = 256;
    const tileCount = 2 ** zoom;

    for (let x = Math.floor(left / size); x <= Math.floor((left + width) / size); x += 1) {
        for (let y = Math.floor(top / size); y <= Math.floor((top + height) / size); y += 1) {
            if (y < 0 || y >= tileCount) continue;

            const tile = document.createElement('img');
            tile.className = 'map-tile';
            tile.alt = '';
            tile.draggable = false;
            tile.src = `https://tile.openstreetmap.org/${zoom}/${((x % tileCount) + tileCount) % tileCount}/${y}.png`;
            tile.style.left = `${x * size - left}px`;
            tile.style.top = `${y * size - top}px`;
            tiles.appendChild(tile);
        }
    }
};

export const renderMap = (restaurants = currentRestaurants) => {
    currentRestaurants = restaurants;
    const mapped = restaurants
        .map((restaurant) => ({restaurant, coordinates: getCoordinates(restaurant)}))
        .filter((item) => item.coordinates);

    tiles.replaceChildren();
    markers.replaceChildren();
    map.classList.toggle('map-empty', mapped.length === 0);
    if (!mapped.length) return;

    const points = mapped.map((item) => item.coordinates);
    const zoom = getZoom(points);
    const rect = map.getBoundingClientRect();
    const width = Math.max(rect.width, 300);
    const height = Math.max(rect.height, 360);
    const centerLat = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
    const centerLon = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
    const left = worldX(centerLon, zoom) - width / 2;
    const top = worldY(centerLat, zoom) - height / 2;

    drawTiles(zoom, left, top, width, height);

    mapped.forEach(({restaurant, coordinates}) => {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'map-marker';
        marker.dataset.id = restaurant._id;
        marker.title = restaurant.name;
        marker.setAttribute('aria-label', `Open ${restaurant.name}`);
        marker.classList.toggle('nearest', restaurant._id === mapState.nearestRestaurantId);
        marker.style.left = `${worldX(coordinates.longitude, zoom) - left}px`;
        marker.style.top = `${worldY(coordinates.latitude, zoom) - top}px`;
        markers.appendChild(marker);
    });

    if (mapState.userPosition) {
        const marker = document.createElement('span');
        marker.className = 'user-map-marker';
        marker.title = 'Your location';
        marker.style.left = `${worldX(mapState.userPosition.longitude, zoom) - left}px`;
        marker.style.top = `${worldY(mapState.userPosition.latitude, zoom) - top}px`;
        markers.appendChild(marker);
    }
};

const findNearest = () => {
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Geolocation is not supported by this browser.';
        return;
    }

    locationStatus.textContent = 'Getting your location...';

    navigator.geolocation.getCurrentPosition(({coords}) => {
        mapState.userPosition = {latitude: coords.latitude, longitude: coords.longitude};
        let nearest = null;
        let bestDistance = Infinity;

        for (const restaurant of getAllRestaurants()) {
            const coordinates = getCoordinates(restaurant);
            if (!coordinates) continue;

            const distance = distanceInKm(
                coords.latitude,
                coords.longitude,
                coordinates.latitude,
                coordinates.longitude
            );

            if (distance < bestDistance) {
                nearest = restaurant;
                bestDistance = distance;
            }
        }

        mapState.nearestRestaurantId = nearest?._id || null;
        locationStatus.textContent = nearest
            ? `Nearest: ${nearest.name} (${bestDistance.toFixed(1)} km away)`
            : 'No restaurant coordinates were available.';

        nearestChanged();
        renderMap();
    }, () => {
        locationStatus.textContent = 'Location access was denied or unavailable.';
    }, {enableHighAccuracy: true, timeout: 10000, maximumAge: 300000});
};

export const initMap = (options) => {
    getAllRestaurants = options.getRestaurants;
    openRestaurant = options.openRestaurant;
    nearestChanged = options.nearestChanged;

    locateButton.addEventListener('click', findNearest);
    markers.addEventListener('click', (event) => {
        const id = event.target.closest('.map-marker')?.dataset.id;
        const restaurant = getAllRestaurants().find((item) => item._id === id);
        if (restaurant) openRestaurant(restaurant);
    });

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => renderMap(), 150);
    });
};
