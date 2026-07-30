module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // The app themes at runtime (light/dark via useTheme), so color/layout
    // styles are legitimately dynamic and must be inline or memoized. The
    // inline-style rule fights that pattern with no real benefit here.
    'react-native/no-inline-styles': 'off',
  },
};
