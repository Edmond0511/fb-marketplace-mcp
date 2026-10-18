// Live check against Facebook, run by hand before a release. CI never runs it.
// Usage: npm run smoke
import { createFacebookClient } from "../dist/adapters/facebook/client.js";

const fb = createFacebookClient();
const check = async (name, run) => {
  try {
    console.log(`ok   ${name}: ${await run()}`);
  } catch (err) {
    console.log(`FAIL ${name}: ${err.code ?? ""} ${err.message}`);
    process.exitCode = 1;
  }
};

let place;
let firstId;
await check("findPlace", async () => {
  place = await fb.findPlace("Waterloo, Ontario");
  if (!place) throw new Error("no place found");
  return `${place.name} (page ${place.pageId})`;
});
await check("guessPlace", async () => {
  const guess = await fb.guessPlace();
  return guess ? `${guess.name} (page ${guess.pageId})` : "no guess on page";
});
await check("search", async () => {
  const listings = await fb.search({ query: "standing desk", place });
  if (listings.length === 0) throw new Error("no listings");
  firstId = listings[0].id;
  return `${listings.length} listings, first "${listings[0].title}" ${listings[0].price?.formatted}`;
});
await check("search (no results)", async () => {
  const listings = await fb.search({ query: "qzxv wkjq plmn", place });
  return `${listings.length} listings`;
});
await check("getListing", async () => {
  const d = await fb.getListing(firstId);
  return `"${d.title}", condition ${d.condition}, ${d.photos.length} photos`;
});
