'use strict';

import {initMap, renderMap} from './map.js';
import {initProfile, loadCurrentUser} from './profile.js';
import {getAllRestaurants, initRestaurants, loadRestaurants, openRestaurant, renderRestaurants} from './restaurants.js';

initProfile();
initRestaurants(renderMap);
initMap({
    getRestaurants: getAllRestaurants,
    openRestaurant,
    nearestChanged: renderRestaurants,
});

await Promise.all([
    loadRestaurants(),
    loadCurrentUser(),
]);
