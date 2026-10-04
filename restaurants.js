import {api} from './api.js';
import {distanceInKm, getCoordinates, mapState} from './map.js';

const list = document.querySelector('#restaurant-list');
const count = document.querySelector('#restaurant-count');
const citySelect = document.querySelector('#city-select');
const searchInput = document.querySelector('#restaurant-search');
const menuModal = document.querySelector('#menu-modal');
const menuContent = document.querySelector('#menu-content');
const menuStatus = document.querySelector('#menu-status');
const menuButtons = document.querySelectorAll('.menu-type');

let allRestaurants = [];
let visibleRestaurants = [];
let selectedRestaurant = null;
let visibleChanged = () => {};

const element = (tag, className, text) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
};

const getFavorites = () => JSON.parse(localStorage.getItem('favorites') || '[]');
const saveFavorites = (favorites) => localStorage.setItem('favorites', JSON.stringify(favorites));

const toggleFavorite = (id) => {
    const favorites = getFavorites();
    saveFavorites(favorites.includes(id)
        ? favorites.filter((favorite) => favorite !== id)
        : [...favorites, id]);
    renderRestaurants();
};

const createRestaurantRow = (restaurant, favorites) => {
    const row = element('button', 'restaurant-button');
    row.type = 'button';
    row.dataset.id = restaurant._id;
    row.classList.toggle('nearest', restaurant._id === mapState.nearestRestaurantId);

    const info = element('div', 'restaurant-info');
    const title = element('div', 'restaurant-title-row');
    title.appendChild(element('strong', '', restaurant.name));

    if (restaurant._id === mapState.nearestRestaurantId) {
        title.appendChild(element('span', 'nearest-badge', 'Nearest'));
    }

    info.append(
        title,
        element('span', '', [restaurant.address, restaurant.city].filter(Boolean).join(', '))
    );

    if (mapState.userPosition) {
        const coordinates = getCoordinates(restaurant);
        if (coordinates) {
            const km = distanceInKm(
                mapState.userPosition.latitude,
                mapState.userPosition.longitude,
                coordinates.latitude,
                coordinates.longitude
            );
            info.appendChild(element('span', 'distance', `${km.toFixed(1)} km away`));
        }
    }

    const favorite = favorites.includes(restaurant._id);
    const star = element('span', `star-btn${favorite ? ' active' : ''}`, favorite ? '★' : '☆');
    star.role = 'button';
    star.tabIndex = 0;
    star.setAttribute('aria-label', favorite ? 'Remove from favorites' : 'Add to favorites');

    row.append(info, star);
    return row;
};

export const renderRestaurants = () => {
    const favorites = getFavorites();
    const restaurants = [...visibleRestaurants].sort((a, b) => {
        if (a._id === mapState.nearestRestaurantId) return -1;
        if (b._id === mapState.nearestRestaurantId) return 1;
        if (favorites.includes(a._id) !== favorites.includes(b._id)) {
            return favorites.includes(a._id) ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });

    list.replaceChildren();
    count.textContent = `${restaurants.length} restaurant${restaurants.length === 1 ? '' : 's'}`;

    if (!restaurants.length) {
        list.appendChild(element('p', 'empty-state', 'No restaurants match your filters.'));
        return;
    }

    restaurants.forEach((restaurant) => list.appendChild(createRestaurantRow(restaurant, favorites)));
};

const filterRestaurants = () => {
    const city = citySelect.value;
    const search = searchInput.value.trim().toLowerCase();

    visibleRestaurants = allRestaurants.filter((restaurant) => {
        const cityMatches = city === 'All cities' || restaurant.city?.toLowerCase() === city.toLowerCase();
        const text = [restaurant.name, restaurant.address, restaurant.city, restaurant.company]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return cityMatches && (!search || text.includes(search));
    });

    renderRestaurants();
    visibleChanged(visibleRestaurants);
};

const populateCities = () => {
    const cities = [...new Set(allRestaurants.map((restaurant) => restaurant.city).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    citySelect.replaceChildren(new Option('All cities', 'All cities'));
    cities.forEach((city) => citySelect.add(new Option(city, city)));
};

const renderCourses = (container, courses = []) => {
    if (!courses.length) {
        container.appendChild(element('p', 'muted', 'No meals listed.'));
        return;
    }

    courses.forEach((course) => {
        const meal = element('article', 'meal');
        meal.append(
            element('h3', '', course.name || 'Meal'),
            element('p', '', `Diets: ${course.diets?.length ? course.diets.join(', ') : 'N/A'}`),
            element('p', '', `Price: ${course.price || 'Not provided'}`)
        );
        container.appendChild(meal);
    });
};

const getWeeklyDays = (menu) => {
    if (Array.isArray(menu)) return menu;
    if (Array.isArray(menu?.days)) return menu.days;
    if (Array.isArray(menu?.menu)) return menu.menu;
    if (menu?.courses) return [menu];
    return [];
};

const renderMenu = (menu, type) => {
    menuContent.replaceChildren();

    if (type === 'daily') {
        renderCourses(menuContent, menu?.courses || []);
        return;
    }

    const days = getWeeklyDays(menu);
    if (!days.length) {
        menuStatus.textContent = 'No weekly menu is available for this restaurant.';
        return;
    }

    days.forEach((day, index) => {
        const section = element('section', 'menu-day');
        section.appendChild(element('h3', 'menu-day-title', day.date || day.day || day.weekday || `Day ${index + 1}`));
        renderCourses(section, day.courses || day.meals || []);
        menuContent.appendChild(section);
    });
};

const loadMenu = async (type) => {
    if (!selectedRestaurant) return;

    menuButtons.forEach((button) => button.classList.toggle('active', button.dataset.menuType === type));
    menuContent.replaceChildren();
    menuStatus.textContent = `Loading ${type} menu...`;

    try {
        const menu = await api.getMenu(selectedRestaurant._id, type);
        menuStatus.textContent = '';
        renderMenu(menu, type);
    } catch (error) {
        menuStatus.textContent = `No ${type} menu is available for this restaurant.`;
    }
};

export const openRestaurant = async (restaurant) => {
    selectedRestaurant = restaurant;
    document.querySelector('#restaurant-name').textContent = restaurant.name;
    document.querySelector('#restaurant-address').textContent = [
        restaurant.address,
        restaurant.postalCode,
        restaurant.city,
    ].filter(Boolean).join(', ');
    menuModal.showModal();
    await loadMenu('daily');
};

export const getAllRestaurants = () => allRestaurants;

export const loadRestaurants = async () => {
    list.innerHTML = '<p class="muted">Loading restaurants...</p>';

    try {
        allRestaurants = await api.getRestaurants();
        populateCities();
        filterRestaurants();
    } catch (error) {
        list.innerHTML = '<p class="error-message">Could not load restaurants.</p>';
    }
};

export const initRestaurants = (onVisibleChanged) => {
    visibleChanged = onVisibleChanged;

    citySelect.addEventListener('change', filterRestaurants);
    searchInput.addEventListener('input', filterRestaurants);
    document.querySelector('#close-modal').addEventListener('click', () => menuModal.close());

    menuButtons.forEach((button) => {
        button.addEventListener('click', () => loadMenu(button.dataset.menuType));
    });

    list.addEventListener('click', (event) => {
        const row = event.target.closest('.restaurant-button');
        if (!row) return;

        if (event.target.closest('.star-btn')) {
            event.stopPropagation();
            toggleFavorite(row.dataset.id);
            return;
        }

        const restaurant = allRestaurants.find((item) => item._id === row.dataset.id);
        if (restaurant) openRestaurant(restaurant);
    });

    list.addEventListener('keydown', (event) => {
        if (!event.target.matches('.star-btn') || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        event.target.click();
    });
};
