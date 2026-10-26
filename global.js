console.log('IT\'S ALIVE!');

const BASE_PATH = '/portfolio/';

function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
}

let pages = [
    { url: '', title: 'Home' },
    { url: 'contact/', title: 'Contact' },
    { url: 'projects/', title: 'Projects' },
    { url: 'resume/', title: 'Resume' },
    { url: 'https://github.com/jppolizzi', title: 'Github Profile'},
];

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
    let url = p.url;
    let title = p.title;
    if (!url.startsWith('http')) {
        url = BASE_PATH + url;
    }
    
    let a = document.createElement('a');
    a.href = url;
    a.textContent = title;
    a.classList.toggle('current', a.host === location.host && a.pathname === location.pathname);
    if (a.host !== location.host) {
        a.target = '_blank';
    }
    nav.append(a);
}

document.body.insertAdjacentHTML(
    'afterbegin',
    `<label class="color-scheme">
        Theme:
        <select>
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>`,
);

let select = document.querySelector('.color-scheme select');

if (localStorage.colorScheme) {
    document.documentElement.style.setProperty('color-scheme', localStorage.colorScheme);
    select.value = localStorage.colorScheme;
}

select.addEventListener('input', function (event) {
    console.log('color scheme changed to', event.target.value);
    document.documentElement.style.setProperty('color-scheme', event.target.value);
    localStorage.colorScheme = event.target.value
})
let form = document.querySelector('form');
form?.addEventListener('submit', function (event) {
    event.preventDefault();
    let data = new FormData(form);
    let url = form.action + '?';
    for (let [name, value] of data) {
        url += name + '=' + encodeURIComponent(value) + '&';
    }
    url = url.slice(0, -1);
    location.href = url;
});

export async function fetchJSON(url) {
    try {
        // fetch the json file from the given url
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.statusText}`);
        }

        const data = await response.json();

        return data;

    } catch (error) {
        console.error('Error fetching or prsing JSON data', error);
    }
}

export function renderProjects(project, containerElement, headingLevel = 'h2') {
    containerElement.innerHTML = '';

    project.forEach(project => {
        const article = document.createElement('article');

        const imgSrc = project.image.startsWith('http') ? project.image : `${BASE_PATH}${project.image}`;
        const title = `<h3>${project.title}</h3>`;
        const img = `<img src="${imgSrc}" alt="${project.title}">`;
        const header = project.url
            ? `<a href="${project.url}" target="_blank" rel="noopener">${title}${img}</a>`
            : `${title}${img}`;
        article.innerHTML = `
            ${header}
            <div>
                <p>${project.description}</p>
                <p class="project-year">${project.year}</p>
            </div>
        `;
        containerElement.appendChild(article);
    });
}

export async function fetchGitHubData(username) {
    const cacheKey = `github-data-${username}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600_000) return data;
    }
    try {
        const response = await fetch(`https://api.github.com/users/${username}`);
        if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);
        const data = await response.json();
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        return data;
    } catch (error) {
        console.error('Error fetching GitHub data', error);
        return cached ? JSON.parse(cached).data : null;
    }
}

