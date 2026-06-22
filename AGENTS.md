# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Premium Frontend Design Guidelines (Anti-AI Slop)

When designing or modifying frontend components, pages, or interfaces, you MUST avoid generic, plain, or boring "AI template" aesthetics. Implement production-grade interfaces with exceptional attention to detail:

1. **Brand Aesthetic Definition**:
   - Every interface must feel cohesive and true to the Balmiza branding (Balmiza Red `#DF0A0A`, Graphite `#1C1C1E`, success Green `#2F855A`).
   - Use curated harmonic colors, premium subtle gradients, and soft shadows rather than plain borders or hard colors.

2. **Interactive States & Hover Effects**:
   - Every button, card, and clickable list item should react immediately to user interactions with micro-animations.
   - For web/desktop, implement a 200ms `bezier(0.4, 0, 0.2, 1)` transition for hover effects (scale-ups e.g. `1.02x`, shadow intensity changes).

3. **Smooth Layout & Entrance Animations**:
   - Use soft slide-ins and staggered fade-ins for loaded data or modal displays.
   - Avoid sudden, jarring layout shifts. Ensure loading states use elegant skeletons or animated elements.

4. **Premium Typography & Whitespace**:
   - Emphasize visual hierarchy using contrasting font weights (e.g., Ultra Bold titles paired with elegant Light/Medium descriptions).
   - Never clutter elements. Allow generous whitespace (padding/margins) to let the layout breathe.

