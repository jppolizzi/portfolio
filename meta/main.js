import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line), // or just +row.line
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + row.timezone),
        datetime: new Date(row.datetime),
    }));

    return data;
}

function processCommits(data) {
    return d3
        .groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            let first = lines[0];
            let { author, date, time, timezone, datetime } = first;
            let ret = {
                id: commit,
                url: 'https://github.com/jppolizzi/portfolio/commit/' + commit,
                author,
                date,
                time,
                timezone,
                datetime,
                // Hour as a decimal, e.g. 2:30 PM = 14.5
                hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
                totalLines: lines.length,
            };

            // Hidden so it doesn't clutter the console, but still accessible as commit.lines
            Object.defineProperty(ret, 'lines', {
                value: lines,
                enumerable: false,
                writable: false,
                configurable: false,
            });

            return ret;
        });
}

function renderCommitInfo(data, commits) {
    // Clear previous stats so this can be re-run when the slider changes
    d3.select('#stats').selectAll('*').remove();
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    // Total LOC
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);

    // Total commits
    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);

    // Number of files
    dl.append('dt').text('Files');
    dl.append('dd').text(d3.group(data, (d) => d.file).size);

    // Longest file (by number of lines)
    const fileLengths = d3.rollups(
        data,
        (v) => d3.max(v, (d) => d.line),
        (d) => d.file,
    );
    const longestFile = d3.greatest(fileLengths, (d) => d[1]);
    dl.append('dt').text('Longest file');
    dl.append('dd')
        .attr('title', longestFile?.[0])
        .text(`${longestFile?.[1]} lines`);

    // Average line length (in characters)
    dl.append('dt').text('Avg line length');
    dl.append('dd').text(d3.mean(data, (d) => d.length).toFixed(1));

    // Maximum depth
    dl.append('dt').text('Max depth');
    dl.append('dd').text(d3.max(data, (d) => d.depth));

    // Time of day that most work is done
    const workByPeriod = d3.rollups(
        data,
        (v) => v.length,
        (d) => d.datetime.toLocaleString('en', { dayPeriod: 'short' }),
    );
    const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
    dl.append('dt').text('Most active time');
    dl.append('dd').text(maxPeriod);
}

function renderTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');
    const time = document.getElementById('commit-tooltip-time');
    const author = document.getElementById('commit-author');
    const lines = document.getElementById('commit-lines');

    if (Object.keys(commit).length === 0) return;

    link.href = commit.url;
    link.textContent = commit.id;
    date.textContent = commit.datetime?.toLocaleString('en', {
        dateStyle: 'full',
    });
    time.textContent = commit.datetime?.toLocaleString('en', {
        timeStyle: 'short',
    });
    author.textContent = commit.author;
    lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX}px`;
    tooltip.style.top = `${event.clientY}px`;
}

let xScale;
let yScale;

function isCommitSelected(selection, commit) {
    if (!selection) {
        return false;
    }
    const [x0, x1] = selection.map((d) => d[0]);
    const [y0, y1] = selection.map((d) => d[1]);
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
    const selectedCommits = selection
        ? filteredCommits.filter((d) => isCommitSelected(selection, d))
        : [];

    const countElement = document.querySelector('#selection-count');
    countElement.textContent = `${
        selectedCommits.length || 'No'
    } commits selected`;

    return selectedCommits;
}

function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
        ? filteredCommits.filter((d) => isCommitSelected(selection, d))
        : [];
    const container = document.getElementById('language-breakdown');

    if (selectedCommits.length === 0) {
        container.innerHTML = '';
        return;
    }
    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines);

    // Count lines per language
    const breakdown = d3.rollup(
        lines,
        (v) => v.length,
        (d) => d.type,
    );

    container.innerHTML = '';

    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        const formatted = d3.format('.1~%')(proportion);

        container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
    }
}

function brushed(event) {
    const selection = event.selection;
    d3.selectAll('circle').classed('selected', (d) =>
        isCommitSelected(selection, d),
    );
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
}

function createBrushSelector(svg) {
    svg.call(d3.brush().on('start brush end', brushed));

    // Raise dots and everything after the brush overlay so they get mouse events
    svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;

    const svg = d3
        .select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([0, width])
        .nice();

    yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);

    const margin = { top: 10, right: 10, bottom: 30, left: 20 };

    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    // Update scales with new ranges (before drawing, so dots use them)
    xScale.range([usableArea.left, usableArea.right]);
    yScale.range([usableArea.bottom, usableArea.top]);

    // Add gridlines BEFORE the dots and axes so they sit underneath
    const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);

    // Gridlines are an axis with no labels and full-width ticks
    gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

    // Color each gridline by time of day: blue at night, orange around noon
    const timeColor = d3
        .scaleLinear()
        .domain([0, 6, 12, 18, 24])
        .range(['#1f4e9c', '#4a90d9', '#f28c28', '#4a90d9', '#1f4e9c'])
        .interpolate(d3.interpolateRgb);

    gridlines.selectAll('.tick line').style('stroke', (d) => timeColor(d));

    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

    // Sort by size descending so smaller dots are drawn on top of larger ones
    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

    const dots = svg.append('g').attr('class', 'dots');

    dots
        .selectAll('circle')
        .data(sortedCommits, (d) => d.id)
        .join('circle')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('r', (d) => rScale(d.totalLines))
        .attr('fill', 'steelblue')
        .style('fill-opacity', 0.7) // Transparency for overlapping dots
        .on('mouseenter', (event, commit) => {
            d3.select(event.currentTarget).style('fill-opacity', 1);
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).style('fill-opacity', 0.7);
            updateTooltipVisibility(false);
        });

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

    svg
        .append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .attr('class', 'x-axis')
        .call(xAxis);

    svg
        .append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .attr('class', 'y-axis')
        .call(yAxis);

    createBrushSelector(svg);
}

function updateScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;
    const margin = { top: 10, right: 10, bottom: 30, left: 20 };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    const svg = d3.select('#chart').select('svg');

    xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));

    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

    const xAxis = d3.axisBottom(xScale);

    // Clear out the existing x-axis and redraw it with the new domain
    const xAxisGroup = svg.select('g.x-axis');
    xAxisGroup.selectAll('*').remove();
    xAxisGroup.call(xAxis);

    const dots = svg.select('g.dots');

    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
    dots
        .selectAll('circle')
        .data(sortedCommits, (d) => d.id)
        .join('circle')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('r', (d) => rScale(d.totalLines))
        .attr('fill', 'steelblue')
        .style('fill-opacity', 0.7) // Transparency for overlapping dots
        .on('mouseenter', (event, commit) => {
            d3.select(event.currentTarget).style('fill-opacity', 1);
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).style('fill-opacity', 0.7);
            updateTooltipVisibility(false);
        });
}

let data = await loadData();
// Sort chronologically so the story (and "first commit") follows commit order
let commits = d3.sort(processCommits(data), (d) => d.datetime);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

let commitMaxTime = d3.max(commits, (d) => d.datetime);

// Will get updated as the user scrolls through the story
let filteredCommits = commits;

// Maps technology (line type) to a color; defined once so colors stay stable
let colors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFileDisplay(filteredCommits) {
    let lines = filteredCommits.flatMap((d) => d.lines);
    let files = d3
        .groups(lines, (d) => d.file)
        .map(([name, lines]) => {
            return { name, lines };
        })
        .sort((a, b) => b.lines.length - a.lines.length);

    let filesContainer = d3
        .select('#files')
        .selectAll('div')
        .data(files, (d) => d.name)
        .join(
            // This code only runs when the div is initially rendered
            (enter) =>
                enter.append('div').call((div) => {
                    div.append('dt').append('code');
                    div.append('dd');
                }),
        );

    // This code updates the div info
    filesContainer
        .select('dt')
        .html((d) => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);

    // append one div for each line
    filesContainer
        .select('dd')
        .selectAll('div')
        .data((d) => d.lines)
        .join('div')
        .attr('class', 'loc')
        .attr('style', (d) => `--color: ${colors(d.type)}`);
}

// Update the scatter plot, stats, and file sizes to show commits up to maxTime
function updateCommitMaxTime(maxTime) {
    commitMaxTime = maxTime;

    filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
    updateScatterPlot(data, filteredCommits);
    renderCommitInfo(
        filteredCommits.flatMap((d) => d.lines),
        filteredCommits,
    );
    updateFileDisplay(filteredCommits);
}

updateCommitMaxTime(commitMaxTime);

function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

// Describe a commit using its own data so each step reads differently
function describeCommit(d, i) {
    const date = d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
    });

    const files = d3
        .rollups(d.lines, (D) => D.length, (l) => l.file)
        .sort((a, b) => b[1] - a[1]);
    const fileNames = files.map(([name]) => `<code>${name}</code>`);
    const fileList =
        fileNames.length <= 3
            ? fileNames.join(', ')
            : `${fileNames.slice(0, 3).join(', ')} and ${plural(fileNames.length - 3, 'other file')}`;

    const [mainType] = d3.greatest(
        d3.rollups(d.lines, (D) => D.length, (l) => l.type),
        (t) => t[1],
    );

    const size =
        d.totalLines < 20
            ? 'a small tweak'
            : d.totalLines < 100
              ? 'a solid chunk of work'
              : 'a big push';

    const runningTotal = d3.sum(commits.slice(0, i + 1), (c) => c.totalLines);

    const opener =
        i === 0
            ? `<a href="${d.url}" target="_blank">my first commit</a> got things started`
            : `<a href="${d.url}" target="_blank">this commit</a> was ${size}`;

    return `
        On ${date}, ${opener}:
        ${plural(d.totalLines, 'line')} across ${plural(files.length, 'file')}
        (${fileList}), mostly ${mainType.toUpperCase()}.
        That brought the site to ${plural(runningTotal, 'line')} of code.
    `;
}

d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(describeCommit);

function onStepEnter(response) {
    updateCommitMaxTime(response.element.__data__.datetime);
}

const scroller = scrollama();
scroller
    .setup({
        container: '#scrolly-1',
        step: '#scrolly-1 .step',
    })
    .onStepEnter(onStepEnter);

