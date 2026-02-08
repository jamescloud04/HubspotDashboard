# Contributing

Thank you for your interest in contributing to the HubSpot Analytics Dashboard!

## Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/HubspotDashboard.git
   cd HubspotDashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Development Workflow

### Code Style

- Use ES6+ features (async/await, arrow functions, destructuring)
- Keep functions focused and under 50 lines when possible
- Comment complex logic
- Use descriptive variable names

### File Structure

Respect the existing structure:
- `/src/data` - Data parsing and transformation
- `/src/kpis` - KPI definitions and computations
- `/src/ui` - User interface components and interactions
- `/src/styles` - CSS styling

### Adding Features

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Keep commits focused and atomic
   - Write clear commit messages

3. **Test your work**
   - Run `npm test` to ensure tests pass
   - Test manually with sample data
   - Check console for errors (F12)

4. **Submit pull request**
   - Describe what your change does
   - Link any related issues
   - Include before/after screenshots if UI change

## Adding a New KPI

1. **Add KPI definition** to `src/kpis/definitions.js`:
   ```javascript
   'my_new_kpi': {
       id: 'my_new_kpi',
       label: 'My New KPI',
       description: 'What this metric measures',
       tooltip: 'How it\'s calculated',
       formatter: 'currency',  // 'currency', 'percent', or 'integer'
       dependencies: ['leads'],  // which datasets needed
       drilldown: { table: 'leads', filter: null }
   }
   ```

2. **Add compute function** to `src/kpis/compute.js`:
   ```javascript
   function computeMyNewKPI(data) {
       const value = data.reduce((sum, row) => {
           // calculation logic
           return sum;
       }, 0);
       return { value, denominator: null, numerator: value };
   }
   ```

3. **Register in `computeAllKPIs()`**:
   ```javascript
   if (youHaveData) {
       kpiValues['my_new_kpi'] = computeMyNewKPI(yourData);
   }
   ```

4. **Test**:
   - Run `npm test`
   - Upload test CSV files
   - Verify KPI renders and updates with filters

## Adding a New Chart

1. **Add canvas to HTML** in `index.html`:
   ```html
   <div class="chart-card">
       <h3>My Chart Title</h3>
       <canvas id="my-chart-id"></canvas>
   </div>
   ```

2. **Add render function** in `src/main.js`:
   ```javascript
   function renderMyChart() {
       const ctx = document.getElementById('my-chart-id');
       if (!ctx) return;
       
       const chart = new window.Chart(ctx, {
           type: 'bar',
           data: {
               labels: ['A', 'B', 'C'],
               datasets: [{
                   label: 'Series 1',
                   data: [10, 20, 30],
                   backgroundColor: '#0066cc'
               }]
           },
           options: {
               responsive: true,
               maintainAspectRatio: true
           }
       });
       
       chartsInstances['my-chart'] = chart;
   }
   ```

3. **Call in `renderChartsSection()`** and clean up in `destroyCharts()`

## Testing Changes

### Manual Testing Checklist

- [ ] Data uploads successfully
- [ ] KPIs calculate correctly
- [ ] Charts render cleanly
- [ ] Tables sort and search work
- [ ] Filters apply and reset
- [ ] Export CSV works
- [ ] Detail modal opens on row click
- [ ] Insights display
- [ ] Data quality report shows issues
- [ ] Responsive on mobile (Ctrl+Shift+M in Chrome)
- [ ] No console errors (F12)

### Unit Testing

Add tests to `test.js`:

```javascript
console.log('Test: My Feature');
assert(myFunction(input) === expectedOutput, 'Test failed');
console.log('✅ My Feature test passed\n');
```

Run tests:
```bash
npm test
```

## Reporting Issues

Found a bug? Create an issue with:

1. **Description**: What's the problem?
2. **Steps to reproduce**: How do you trigger it?
3. **Expected behavior**: What should happen?
4. **Actual behavior**: What actually happens?
5. **Environment**: Browser, OS, Node version
6. **Sample data**: (Optional but helpful - anonymize if sensitive)

## Performance Considerations

- Keep data processing under 1 second for 5000+ rows
- Charts should render in <200ms
- Use debouncing for filter inputs
- Avoid unnecessary re-renders
- Profile performance with DevTools (→ Performance tab)

## Accessibility

- Ensure keyboard navigation works
- Use semantic HTML (`<button>`, `<label>`)
- Provide `alt` text for images
- Maintain color contrast ratios
- Test with screen reader occasionally

## Documentation

- Update README.md if adding features
- Document complex functions
- Add comments for non-obvious logic
- Update DEPLOYMENT.md if changing build process

## Questions or Discussion?

- Create a Discussion in GitHub
- Check existing Issues for similar topics
- Reference related docs/code in comments

## Release Process

Releases follow semantic versioning:
- **Major** (x.0.0): Breaking changes, major features
- **Minor** (0.x.0): New features, backwards compatible
- **Patch** (0.0.x): Bugfixes

## Code Review

- Be open to feedback
- Respond to PR comments promptly
- Make requested changes in new commits (don't force push)
- Thank reviewers for their time

---

**Thank you for contributing! Your help makes this tool better for everyone. 🎉**
