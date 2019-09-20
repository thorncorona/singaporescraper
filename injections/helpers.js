function chain(chained) {
  console.log(chained.length, chained);
  if (chained.length === 0) return;
  let chainElement = chained[0];
  setTimeout(function() {
    chainElement.fn();
    chained.splice(0, 1);
    chain(chained);
  }, chainElement.delay);
}

