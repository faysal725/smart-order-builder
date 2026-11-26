import type { Menu } from "../engine/types";

// Source: Appendix A. Money in poisha (BDT x 100).
// Ingredient missing from `stock` = unlimited (ketchup, chili).
export const menu: Menu = {
  basePrice: 25000, // 250 BDT

  groups: [
    {
      id: "bread",
      name: "Bread",
      min: 1,
      max: 1,
      options: [
        { id: "toast", name: "Toast", price: 0, ingredients: { toast: 1 } },
        { id: "paratha", name: "Paratha", price: 2000, ingredients: { paratha: 1 } },
        { id: "croissant", name: "Croissant", price: 6000, ingredients: { croissant: 1 } },
      ],
    },
    {
      id: "eggs",
      name: "Eggs",
      min: 2,
      max: 6,
      step: 2,
      options: [
        { id: "fried", name: "Fried", price: 3000, ingredients: { egg: 1 } },
        { id: "scrambled", name: "Scrambled", price: 3500, ingredients: { egg: 1 } },
        { id: "omelette", name: "Omelette", price: 7000, ingredients: { egg: 2 } },
      ],
    },
    {
      id: "protein",
      name: "Protein",
      min: 1,
      max: 3,
      options: [
        { id: "sausage", name: "Chicken Sausage", price: 6000, ingredients: { sausage: 1 } },
        { id: "bacon", name: "Beef Bacon", price: 9000, ingredients: { bacon: 1 } },
        { id: "tofu", name: "Tofu", price: 5000, ingredients: { tofu: 1 } },
      ],
    },
    {
      id: "extras",
      name: "Extras",
      min: 0,
      max: 4,
      options: [
        { id: "hashbrown", name: "Hash Brown", price: 4000, ingredients: { hashbrown: 1 } },
        { id: "mushroom", name: "Mushroom", price: 3000, ingredients: { mushroom: 1 } },
        { id: "beans", name: "Baked Beans", price: 2500, ingredients: { beans: 1 } },
        { id: "cheese", name: "Cheese", price: 3500, ingredients: { cheese: 1 } },
      ],
    },
    {
      id: "sauce",
      name: "Sauce",
      min: 0,
      max: 99, // Appendix A gives no max. maxDistinct 2 is the real limit
      maxDistinct: 2,
      maxPerOption: 1,
      options: [
        { id: "ketchup", name: "Ketchup", price: 0, ingredients: {} },
        { id: "hollandaise", name: "Hollandaise", price: 2500, ingredients: { hollandaise: 1 } },
        { id: "chili", name: "Chili", price: 1000, ingredients: {} },
      ],
    },
  ],

  rules: [
    { type: "requires", id: "R1", option: "hollandaise", anyOf: ["scrambled", "omelette"] },
    { type: "excludes", id: "R2", option: "tofu", excluded: ["sausage", "bacon"] },
    { type: "overrideLimit", id: "R3", ifOption: "croissant", group: "extras", max: 2 },
    { type: "excludes", id: "R4", option: "chili", excluded: ["hollandaise"] },
  ],

  stock: {
    egg: 10,
    sausage: 4,
    bacon: 3,
    tofu: 5,
    croissant: 2,
    paratha: 10,
    toast: 20,
    hashbrown: 6,
    mushroom: 6,
    beans: 8,
    cheese: 4,
    hollandaise: 5,
  },
};