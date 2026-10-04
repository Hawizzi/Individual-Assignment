import {api, auth} from './api.js';

const $ = (id) => document.getElementById(id);

const registerButton = $('register');
const loginButton = $('login-button');
const profileButton = $('profile-button');
const logoutButton = $('logout-button');

const registerModal = $('register-modal');
const loginModal = $('login-modal');
const profileModal = $('profile-modal');

const registerForm = $('register-form');
const loginForm = $('login-form');
const profileForm = $('profile-form');
const avatarForm = $('avatar-form');

const registerMessage = $('register-message');
const loginMessage = $('login-message');
const profileMessage = $('profile-message');
const profileGallery = $('profile-gallery');
const galleryEmpty = $('profile-gallery-empty');

let currentUser = null;

const imagePairs = [
    [$('profile-image'), $('profile-placeholder')],
    [$('header-profile-image'), $('header-profile-placeholder')],
];

const userStorageKey = (name) => {
    const user = currentUser;
    const id = user?.user_id || user?._id || user?.username;
    return id ? `profile:${id}:${name}` : null;
};

const getPicture = () => {
    const key = userStorageKey('picture');
    return key ? localStorage.getItem(key) : null;
};

const setPicture = (picture) => {
    const key = userStorageKey('picture');
    if (key) localStorage.setItem(key, picture);
};

const getGallery = () => {
    const key = userStorageKey('gallery');
    if (!key) return [];

    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
        return [];
    }
};

const addToGallery = (picture) => {
    const key = userStorageKey('gallery');
    if (!key) return;

    const gallery = [picture, ...getGallery().filter((item) => item !== picture)].slice(0, 8);
    localStorage.setItem(key, JSON.stringify(gallery));
};

const showPicture = (picture) => {
    imagePairs.forEach(([image, placeholder]) => {
        image.hidden = !picture;
        placeholder.hidden = Boolean(picture);
        if (picture) image.src = picture;
        else image.removeAttribute('src');
    });
};

const renderGallery = () => {
    const gallery = getGallery();
    const selected = getPicture();
    profileGallery.replaceChildren();
    galleryEmpty.hidden = gallery.length > 0;

    gallery.forEach((picture, index) => {
        const button = document.createElement('button');
        const image = document.createElement('img');

        button.type = 'button';
        button.className = 'profile-gallery-item';
        button.dataset.index = index;
        button.classList.toggle('active', picture === selected);
        button.title = picture === selected ? 'Current profile picture' : 'Use this profile picture';

        image.src = picture;
        image.alt = `Uploaded profile picture ${index + 1}`;
        button.appendChild(image);
        profileGallery.appendChild(button);
    });
};

const createImagePreview = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
        const image = new Image();
        image.onload = () => {
            const scale = Math.min(1, 320 / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.onerror = () => reject(new Error('Could not read the selected image.'));
        image.src = reader.result;
    };

    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
});

const setUser = (user) => {
    currentUser = user || null;
    const loggedIn = Boolean(auth.getToken());

    registerButton.hidden = loggedIn;
    loginButton.hidden = loggedIn;
    profileButton.hidden = !loggedIn;
    logoutButton.hidden = !loggedIn;

    if (!user) {
        showPicture(null);
        profileGallery.replaceChildren();
        galleryEmpty.hidden = false;
        return;
    }

    profileForm.elements.username.value = user.username || '';
    profileForm.elements.email.value = user.email || '';
    showPicture(getPicture() || user.avatar || user.profilePicture || user.image);
    renderGallery();
};

export const loadCurrentUser = async () => {
    if (!auth.getToken()) {
        setUser(null);
        return;
    }

    try {
        const result = await api.getCurrentUser();
        setUser(result.user || result);
    } catch {
        auth.clearToken();
        setUser(null);
    }
};

const register = async (event) => {
    event.preventDefault();
    registerMessage.textContent = 'Creating account...';

    try {
        await api.register({
            username: registerForm.elements.username.value.trim(),
            email: registerForm.elements.email.value.trim(),
            password: registerForm.elements.password.value,
        });
        registerForm.reset();
        registerMessage.textContent = 'Account created. You can now log in.';
    } catch (error) {
        registerMessage.textContent = error.message;
    }
};

const login = async (event) => {
    event.preventDefault();
    loginMessage.textContent = 'Logging in...';

    try {
        const result = await api.login({
            username: loginForm.elements.username.value.trim(),
            password: loginForm.elements.password.value,
        });
        const token = result.token || result.access_token || result.accessToken;
        if (!token) throw new Error('No token was returned by the API.');

        auth.setToken(token);
        loginForm.reset();
        loginModal.close();
        await loadCurrentUser();
    } catch (error) {
        loginMessage.textContent = error.message;
    }
};

const updateProfile = async (event) => {
    event.preventDefault();
    profileMessage.textContent = 'Saving changes...';

    const changes = {
        username: profileForm.elements.username.value.trim(),
        email: profileForm.elements.email.value.trim(),
    };
    const password = profileForm.elements.password.value;
    if (password) changes.password = password;

    try {
        const result = await api.updateUser(changes);
        profileForm.elements.password.value = '';
        setUser(result.user || {...currentUser, ...changes});
        profileMessage.textContent = 'Profile updated successfully.';
    } catch (error) {
        profileMessage.textContent = error.message;
    }
};

const uploadPicture = async (event) => {
    event.preventDefault();
    const file = avatarForm.elements.avatar.files[0];

    if (!file?.type.startsWith('image/')) {
        profileMessage.textContent = 'Please choose an image file.';
        return;
    }

    profileMessage.textContent = 'Uploading picture...';

    try {
        await api.uploadFile(file);
        const picture = await createImagePreview(file);
        setPicture(picture);
        addToGallery(picture);
        showPicture(picture);
        renderGallery();
        avatarForm.reset();
        profileMessage.textContent = 'Profile picture uploaded successfully.';
    } catch (error) {
        profileMessage.textContent = error.message;
    }
};

export const initProfile = () => {
    registerForm.addEventListener('submit', register);
    loginForm.addEventListener('submit', login);
    profileForm.addEventListener('submit', updateProfile);
    avatarForm.addEventListener('submit', uploadPicture);

    registerButton.addEventListener('click', () => {
        registerMessage.textContent = '';
        registerModal.showModal();
    });

    loginButton.addEventListener('click', () => {
        loginMessage.textContent = '';
        loginModal.showModal();
    });

    profileButton.addEventListener('click', () => {
        profileMessage.textContent = '';
        renderGallery();
        profileModal.showModal();
    });

    logoutButton.addEventListener('click', () => {
        auth.clearToken();
        setUser(null);
    });

    $('close-register-modal').addEventListener('click', () => registerModal.close());
    $('close-login-modal').addEventListener('click', () => loginModal.close());
    $('close-profile-modal').addEventListener('click', () => profileModal.close());

    profileGallery.addEventListener('click', (event) => {
        const button = event.target.closest('.profile-gallery-item');
        if (!button) return;

        const picture = getGallery()[Number(button.dataset.index)];
        if (!picture) return;

        setPicture(picture);
        showPicture(picture);
        renderGallery();
        profileMessage.textContent = 'Profile picture changed.';
    });
};
