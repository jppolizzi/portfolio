console.log('IT\'S ALIVE!');

const BASE_PATH = 
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/portfolio/portfolio/' // local server
    : '/website/'; //pages'

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
