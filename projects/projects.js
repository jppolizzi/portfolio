import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const projectsTitle = document.querySelector('.projects-title');
projectsTitle.textContent = `${projects.length} Projects`;

let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
let colors = d3.scaleOrdinal(d3.schemeTableau10);
let selectedYear = null;

// Render the cards, limited to the selected year if there is one
function renderCards(projectsGiven) {
  let shown =
    selectedYear === null
      ? projectsGiven
      : projectsGiven.filter((project) => project.year === selectedYear);
  renderProjects(shown, projectsContainer, 'h2');
}

// Refactor all plotting into one function
function renderPieChart(projectsGiven) {
  // re-calculate rolled data
  let newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  // re-calculate data
  let newData = newRolledData.map(([year, count]) => {
    return { value: count, label: year };
  });
  // re-calculate slice generator, arc data, arcs
  let newSliceGenerator = d3.pie().value((d) => d.value);
  let newArcData = newSliceGenerator(newData);
  let newArcs = newArcData.map((d) => arcGenerator(d));

  // a selected year that the current search filtered out is no longer selected
  if (!newData.some((d) => d.label === selectedYear)) {
    selectedYear = null;
  }

  // clear up paths and legends
  let newSVG = d3.select('svg');
  newSVG.selectAll('path').remove();
  let legend = d3.select('.legend');
  legend.selectAll('li').remove();

  // update paths and legends
  function updateSelection() {
    newSVG
      .selectAll('path')
      .attr('class', (_, idx) => (newData[idx].label === selectedYear ? 'selected' : null));
    legend
      .selectAll('li')
      .attr('class', (_, idx) =>
        newData[idx].label === selectedYear
          ? 'legend-item selected'
          : 'legend-item',
      );
  }

  newArcs.forEach((arc, idx) => {
    newSVG
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(idx))
      .on('click', () => {
        let year = newData[idx].label;
        selectedYear = selectedYear === year ? null : year;
        updateSelection();
        renderCards(projectsGiven);
      });
  });
  newData.forEach((d, idx) => {
    legend
      .append('li')
      .attr('class', 'legend-item')
      .attr('style', `--color:${colors(idx)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
  updateSelection();
}

let query = '';

function setQuery(newQuery) {
  query = newQuery;
  return projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });
}

// Call this function on page load
renderPieChart(projects);

let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  let filteredProjects = setQuery(event.target.value);
  // re-render projects, legend and pie chart when event triggers
  renderPieChart(filteredProjects);
  renderCards(filteredProjects);
});

// Clear the search box and show the unfiltered results again
let clearButton = document.querySelector('.clear-search');

clearButton.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  searchInput.focus();
});
