import { add, has, remove } from "../verified";

test("Verification checker", async () => {
  const id = 0;

  await add(id);

  expect(await has(id)).toBeTruthy();

  await remove(id);

  expect(await has(id)).toBeFalsy();
});
