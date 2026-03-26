/**
 * production/app.js
 * Intentionally buggy application code used to demonstrate autonomous self-healing.
 *
 * Bug 1 (UI_NULL_ERROR):  items may be null — causes TypeError on .map()
 * Bug 2 (API_TIMEOUT):    data.value may be undefined — causes crash on .toUpperCase()
 * Bug 3 (CART_EMPTY):     cart may be null — causes crash in for..of loop
 * Bug 4 (RENDER_ERROR):   user.profile may be missing — causes crash on property access
 *
 * The patch engine will fix these bugs autonomously when errors are reported.
 * IMPORTANT: Reset this file to its original state before each demo.
 */

function render(items) {
  // BUG 1: items may be null — will crash without null guard
  if (!items) return [];
  return items.map(i => i.name.toUpperCase());
}

function fetchData(data) {
  // BUG 2: data.value may be undefined — will crash on property access
  return data.value.toUpperCase();
}

function calculateTotal(cart) {
  // BUG 3: cart may be null — will crash in for..of
  let total = 0;
  if (!cart) return 0;
  for (let item of cart) {
    total += item.price;
  }
  return total;
}

function formatUser(user) {
  // BUG 4: user.profile may be missing — will crash on nested access
  return user.profile.name + " (" + user.profile.age + ")";
}

module.exports = {
  render,
  fetchData,
  calculateTotal,
  formatUser
};