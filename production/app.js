function render(items) {
  // BUG 1: items may be null
  if (!items) return [];
  return items.map(i => i.name.toUpperCase());
}

function fetchData(data) {
  // BUG 2: data.value may be undefined
  return data.value.toUpperCase();
}

function calculateTotal(cart) {
  // BUG 3: cart may be empty or null
  let total = 0;
  if (!cart) return 0;
  for (let item of cart) {
    total += item.price;
  }
  return total;
}

function formatUser(user) {
  // BUG 4: user.profile may be missing
  return user.profile.name + " (" + user.profile.age + ")";
}

module.exports = {
  render,
  fetchData,
  calculateTotal,
  formatUser
};