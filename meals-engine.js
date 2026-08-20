/* ============================================================================
   Meal-plan generator — builds a weekly family plan in the same style as the
   original static meal-plan.html, rotating dishes through the family's fixed
   weekly rhythm so each week is fresh but "similar to the one before".
   Deterministic from a small {rot, weekOf} stored in appData.mealPlan, so the
   synced blob stays tiny and the plan regenerates identically on any device.
   ============================================================================ */
(function () {

  // ---- styling (kept in sync with meal-plan.html so generated plans look identical) ----
  const MEAL_CSS = `
  :root{--green:#2d6a4f;--green-light:#b7e4c7;--green-pale:#f0faf4;--orange:#e07a1f;--orange-light:#fce8cc;--blue:#1d6fa4;--blue-light:#d0eaf7;--purple:#6b21a8;--purple-light:#f3e8ff;--red-light:#fee2e2;--red:#991b1b;--yellow-light:#fff3d6;--yellow:#9a6000;--gray:#4a4a4a;--gray-light:#f7f7f7;--border:#e2e8f0;--font:'Segoe UI',system-ui,sans-serif;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:var(--font);color:var(--gray);background:#fff;line-height:1.5;max-width:980px;margin:0 auto;padding:24px 20px 60px;}
  h1{font-size:1.8rem;color:var(--green);margin-bottom:4px;}
  .subtitle{color:#666;font-size:.95rem;margin-bottom:28px;}
  .key{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px;padding:14px 16px;background:var(--gray-light);border-radius:10px;}
  .key-item{display:flex;align-items:center;gap:6px;font-size:.85rem;}
  .badge{display:inline-block;border-radius:12px;padding:2px 9px;font-size:.78rem;font-weight:600;white-space:nowrap;}
  .badge-fish{background:var(--blue-light);color:var(--blue);}.badge-kids{background:var(--yellow-light);color:var(--yellow);}.badge-prep{background:var(--purple-light);color:var(--purple);}.badge-dad{background:var(--red-light);color:var(--red);}.badge-all{background:var(--green-light);color:var(--green);}.badge-pizza{background:#fff0e0;color:#b35000;}.badge-mom{background:#e8f4f8;color:#1d6fa4;}
  .strategy{background:var(--green-pale);border-left:4px solid var(--green);border-radius:0 10px 10px 0;padding:16px 18px;margin-bottom:30px;font-size:.9rem;}
  .strategy h2{font-size:1rem;color:var(--green);margin-bottom:8px;}
  .strategy ul{list-style:none;display:flex;flex-direction:column;gap:5px;}
  .strategy ul li::before{content:"→ ";color:var(--green);font-weight:700;}
  .week-grid{display:flex;flex-direction:column;gap:18px;}
  .day-card{border:1px solid var(--border);border-radius:12px;overflow:hidden;}
  .day-header{background:var(--green);color:#fff;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;}
  .day-header h2{font-size:1.05rem;font-weight:700;}
  .day-header .day-badges{display:flex;gap:6px;}
  .meal-row{display:grid;grid-template-columns:110px 1fr;border-bottom:1px solid var(--border);}
  .meal-row:last-child{border-bottom:none;}
  .meal-label{background:var(--gray-light);padding:12px 14px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#666;display:flex;align-items:flex-start;border-right:1px solid var(--border);}
  .meal-content{padding:12px 16px;}
  .meal-title{font-weight:600;font-size:.95rem;margin-bottom:4px;color:#1a1a1a;}
  .meal-detail{font-size:.83rem;color:#555;display:flex;flex-direction:column;gap:3px;}
  .who-note{font-size:.78rem;margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
  .tip{font-size:.78rem;color:var(--green);font-style:italic;margin-top:5px;}
  .snack-section{margin-top:36px;}
  .snack-section h2{font-size:1.3rem;color:var(--yellow);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--yellow-light);}
  .snack-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  @media(max-width:600px){.snack-grid{grid-template-columns:1fr;}}
  .snack-card{border:1px solid var(--border);border-radius:12px;overflow:hidden;}
  .snack-card-header{padding:8px 14px;font-size:.85rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
  .snack-am .snack-card-header{background:#fff3d6;color:var(--yellow);}.snack-pm .snack-card-header{background:var(--purple-light);color:var(--purple);}
  .snack-items{padding:12px 14px;display:flex;flex-direction:column;gap:8px;}
  .snack-item{display:flex;gap:10px;align-items:flex-start;font-size:.87rem;padding-bottom:7px;border-bottom:1px solid #f0f0f0;}
  .snack-item:last-child{border-bottom:none;padding-bottom:0;}
  .snack-emoji{font-size:1.1rem;flex-shrink:0;margin-top:1px;}
  .snack-text strong{display:block;font-size:.88rem;color:#1a1a1a;}
  .snack-text span{font-size:.8rem;color:#666;}
  .shop-section{margin-top:40px;}
  .shop-section h2{font-size:1.3rem;color:var(--green);margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid var(--green-light);}
  .shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:24px;}
  .shop-category{border:1px solid var(--border);border-radius:10px;overflow:hidden;}
  .shop-cat-header{padding:8px 14px;font-size:.85rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
  .sh-proteins .shop-cat-header{background:var(--red-light);color:var(--red);}.sh-produce .shop-cat-header{background:var(--green-light);color:var(--green);}.sh-dairy .shop-cat-header{background:var(--blue-light);color:var(--blue);}.sh-pantry .shop-cat-header{background:var(--orange-light);color:var(--orange);}.sh-pizza .shop-cat-header{background:#fff0e0;color:#b35000;}.sh-snacks .shop-cat-header{background:var(--yellow-light);color:var(--yellow);}
  .shop-items{padding:10px 14px;display:flex;flex-direction:column;gap:6px;}
  .shop-item{display:flex;justify-content:space-between;align-items:baseline;font-size:.87rem;padding-bottom:5px;border-bottom:1px solid #f0f0f0;}
  .shop-item:last-child{border-bottom:none;}
  .shop-item-name{flex:1;}.shop-item-qty{color:#888;font-size:.8rem;margin:0 10px;}.shop-item-price{font-weight:600;color:var(--green);min-width:40px;text-align:right;}
  .budget-box{margin-top:24px;background:var(--green-pale);border:1px solid var(--green-light);border-radius:12px;padding:20px 22px;}
  .budget-box h3{color:var(--green);font-size:1rem;margin-bottom:14px;}
  .budget-rows{display:flex;flex-direction:column;gap:8px;font-size:.9rem;}
  .budget-row{display:flex;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid var(--green-light);}
  .budget-row:last-child{border-bottom:none;}
  .budget-total{font-weight:700;font-size:1rem;color:var(--green);margin-top:8px;padding-top:8px;border-top:2px solid var(--green);}
  .tips-section{margin-top:36px;}
  .tips-section h2{font-size:1.3rem;color:var(--green);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--green-light);}
  .tips-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}
  .tip-card{background:var(--gray-light);border-radius:10px;padding:14px 16px;font-size:.87rem;}
  .tip-card h4{color:var(--green);margin-bottom:5px;font-size:.9rem;}
  @media print{body{max-width:100%;padding:10px;}.day-card{page-break-inside:avoid;}}
  `;

  // ---- dish pools (rotate through these; kids-friendly, mom pescatarian, dad OMAD big dinners) ----
  const KID = ['kids', '👦 Kids'], MOMV = ['mom', 'Mom'], DAD = ['dad', '🥩 Dad'];

  const BREAKFASTS = [
    { t: 'Protein Pancakes + Fresh Fruit', d: ["Dad's recipe — make a double batch, refrigerate extras for later in the week", 'Served with blueberries or sliced strawberries'], who: [KID, MOMV], dad: 'Dad: skip / coffee' },
    { t: 'Scrambled Eggs + Toast + Banana', d: ['Soft scrambled eggs in butter — kids love them simple', 'Whole wheat toast + banana or any fruit on hand'], who: [KID, MOMV] },
    { t: 'Overnight Oats with Berries', d: ['Prep the night before: oats + milk + chia + honey in mason jars', 'Top with fresh berries in the morning — zero cooking'], who: [KID, MOMV], tip: '5-min prep the night before = zero morning effort' },
    { t: 'Yogurt + Granola + Fresh Fruit', d: ['Greek yogurt, granola, sliced banana or berries — quick, no cook'], who: [KID, MOMV] },
    { t: 'Avocado Toast + Eggs + Fruit', d: ['Whole grain toast + smashed avocado + a fried or poached egg', 'Kids version: avocado + a pinch of salt, fruit on the side'], who: [KID, MOMV] },
    { t: 'Veggie Egg Scramble + Toast', d: ['Scramble eggs with leftover roasted peppers + spinach', 'Toast + fruit on the side'], who: [KID, MOMV] },
    { t: 'French Toast + Fruit', d: ['Dip bread in egg + milk + cinnamon, griddle until golden', 'Top with fruit; light drizzle of honey or syrup'], who: [KID, MOMV] }
  ];
  const WEEKEND_BREAKFAST = { t: 'Weekend Eggs + Turkey Bacon + Fruit Bowl', d: ['Scrambled or over-easy eggs — big skillet for everyone', 'Turkey bacon in the oven at 400°F for 15 min, no mess', 'Cut fruit bowl: melon, grapes, strawberries'], who: [['all', '✅ Dad joins (weekend!)'], KID, MOMV] };

  const LUNCHES = [
    { t: 'Greek Yogurt Parfaits + Apple Slices', d: ['Layer Greek yogurt → granola → berries in cups', 'Add cheese cubes or a hard-boiled egg for extra protein'], who: [KID, MOMV], tip: 'Hard-boil 6 eggs while making breakfast — use all week' },
    { t: 'Cheese Quesadillas + Apple + Carrots', d: ['Flour tortilla + shredded cheddar, 3 min per side', 'Cut into triangles — kids think it’s fun'], who: [KID, ['mom', 'Mom: add spinach + black beans']] },
    { t: 'Grilled Cheese + Tomato Soup', d: ['Canned tomato soup + buttered grilled cheese on a skillet', 'Cut into triangles or fun shapes for the little one'], who: [['kids', '👦 Kids love this'], MOMV] },
    { t: 'Buttered Noodles + Parmesan / Veggie Pasta', d: ['Boil pasta — pull kids’ portion first', 'Adults: toss with olive oil, garlic, roasted veg, parmesan'], who: [['kids', '👦 Kids love it'], MOMV] },
    { t: 'Turkey & Cheese Roll-Ups + Fruit', d: ['Deli turkey + cheese rolled in a tortilla, sliced into pinwheels', 'Fruit + carrot sticks on the side'], who: [KID, MOMV] },
    { t: 'Hummus + Pita + Veggie Sticks', d: ['Hummus with warm pita wedges', 'Carrots, cucumber, bell pepper strips'], who: [KID, MOMV] }
  ];

  const DINNERS = {
    chicken: [
      { t: 'Sheet Pan Chicken Thighs + Roasted Broccoli & Peppers + Rice', badges: [['prep', 'Batch night']], steps: ['Season chicken with olive oil, garlic powder, paprika, salt — roast 425°F, 25 min', 'Toss broccoli + peppers with oil, roast same pan (last 15 min)', 'Rice cooker does the rice hands-free — cook extra for later'], who: [['dad', '🥩 Dad: big portion + extra veg'], KID, ['mom', 'Mom: bake a 6-oz salmon alongside']], shop: [['Chicken thighs (bone-in)', '3 lb', 8, 'proteins'], ['Broccoli crowns', '2 heads', 4, 'produce'], ['Bell peppers', '5', 6, 'produce']] },
      { t: 'Baked Garlic Chicken + Roasted Potatoes + Green Beans', badges: [['prep', 'Batch night']], steps: ['Chicken breasts with garlic, lemon, herbs — bake 400°F, 25 min', 'Baby potatoes tossed in oil + rosemary, same oven', 'Steam or roast green beans'], who: [['dad', '🥩 Dad: extra chicken + veg'], KID, ['mom', 'Mom: white fish alongside']], shop: [['Chicken breast', '2 lb', 10, 'proteins'], ['Baby potatoes', '2 lb', 4, 'produce'], ['Green beans', '1 lb', 3, 'produce']] },
      { t: 'Chicken Fajita Bowls + Rice', badges: [['prep', 'Batch night']], steps: ['Slice chicken + peppers + onion, sauté with fajita seasoning', 'Serve over rice with cheese, salsa, sour cream', 'Kids: plain chicken + cheese + rice'], who: [['dad', '🥩 Dad: double protein'], KID, ['mom', 'Mom: shrimp fajita bowl']], shop: [['Chicken breast', '2 lb', 10, 'proteins'], ['Bell peppers', '4', 5, 'produce'], ['Yellow onion', '2', 2, 'produce']] },
      { t: 'Honey Mustard Baked Chicken + Rice + Broccoli', badges: [['prep', 'Batch night']], steps: ['Coat thighs in honey + mustard + garlic — bake 425°F, 25 min', 'Rice cooker + roasted broccoli on the side'], who: [['dad', '🥩 Dad: big portion'], KID, ['mom', 'Mom: salmon alongside']], shop: [['Chicken thighs (bone-in)', '3 lb', 8, 'proteins'], ['Broccoli crowns', '2 heads', 4, 'produce']] }
    ],
    fish: [
      { t: 'Honey Garlic Salmon + Roasted Asparagus + Rice', steps: ['Mix honey + garlic + soy — brush on salmon; bake 400°F, 12-14 min', 'Asparagus same oven, last 8 min with oil + salt', 'Kids’ portions: plain butter salmon, no glaze'], who: [['fish', '🐟 All eat'], ['dad', '🥩 Dad: big portion + extra veg']], shop: [['Salmon fillet', '2 lb', 18, 'proteins'], ['Asparagus', '1 bunch', 4, 'produce']], tip: 'Buy a 2 lb fillet — reserve half for mom’s salmon tacos later in the week' },
      { t: 'Garlic Butter Shrimp Pasta', steps: ['Boil pasta; sauté shrimp in butter + garlic + lemon (5 min); toss', 'Add broccoli to pasta water last 3 min — one pot, one pan', 'Kids: noodles + butter + parmesan if shrimp is a battle'], who: [['fish', '🐟 All eat'], ['dad', '🥩 Dad: extra shrimp']], shop: [['Shrimp (peeled)', '1.5 lb', 12, 'proteins'], ['Broccoli crowns', '1 head', 2, 'produce']], tip: 'Fastest full dinner of the week — save for your most hectic evening' },
      { t: 'Lemon Herb Cod + Big Roasted Vegetable Sheet Pan', badges: [['prep', 'Prep day']], steps: ['Cod: olive oil + lemon + garlic + herbs — bake 400°F, 12-15 min', 'Double-batch roasted veg: broccoli, peppers, zucchini — feeds Mon/Tue', 'While it bakes: hard-boil 6 eggs, marinate next chicken'], who: [['fish', '🐟 All eat'], ['dad', '🥩 Dad: big piece + extra veg'], ['prep', '⏱ Roasted veg used early next week']], shop: [['Cod fillet', '1.5 lb', 10, 'proteins'], ['Zucchini', '2', 3, 'produce'], ['Bell peppers', '3', 4, 'produce']], tip: '30 min of prep-day effort saves you 30 min across 4 weeknights' },
      { t: 'Baked Tilapia + Rice + Roasted Broccoli', steps: ['Tilapia with lemon, butter, paprika — bake 400°F, 12 min', 'Rice cooker + roasted broccoli', 'Kids: plain buttered tilapia, cut small'], who: [['fish', '🐟 All eat'], ['dad', '🥩 Dad: two fillets']], shop: [['Tilapia fillet', '1.5 lb', 9, 'proteins'], ['Broccoli crowns', '1 head', 2, 'produce']] },
      { t: 'Teriyaki Salmon Bowls + Rice + Veg', steps: ['Glaze salmon with teriyaki — bake 400°F, 12 min', 'Serve over rice with steamed broccoli + carrots', 'Kids: plain salmon + rice'], who: [['fish', '🐟 All eat'], ['dad', '🥩 Dad: big bowl']], shop: [['Salmon fillet', '2 lb', 18, 'proteins'], ['Carrots', '1 lb', 2, 'produce']] },
      { t: 'Shrimp Stir-Fry + Rice', steps: ['Stir-fry shrimp with peppers, broccoli, garlic + soy sauce', 'Serve over rice — 15 min total', 'Kids: shrimp + rice, veggies on the side'], who: [['fish', '🐟 All eat'], ['dad', '🥩 Dad: extra shrimp']], shop: [['Shrimp (peeled)', '1.5 lb', 12, 'proteins'], ['Bell peppers', '3', 4, 'produce'], ['Broccoli crowns', '1 head', 2, 'produce']] }
    ],
    taco: [
      { t: 'Taco Night — Build Your Own', badges: [['kids', '👦 Kids build their own']], steps: ['Ground beef tacos: brown 1 lb beef + taco seasoning (10 min) — kids & dad', 'Salmon tacos: flake reserved salmon into warm tortillas — mom', 'Toppings bar: cheese, sour cream, salsa, lettuce, lime', 'Cook extra rice — use tomorrow for taco bowls'], who: [['dad', '🥩 Dad: beef tacos + salad'], ['kids', '👦 Kids: beef + cheese, build own'], ['fish', '🐟 Mom: salmon tacos']], shop: [['Ground beef 85/15', '1 lb', 7, 'proteins']] },
      { t: 'Taco Bowls Night — Build Your Own', badges: [['kids', '👦 Kids build their own']], steps: ['Season beef; layer over rice with beans, cheese, salsa', 'Mom: shrimp or reserved fish over rice + beans', 'Cook extra rice for tomorrow’s lunch bowls'], who: [['dad', '🥩 Dad: loaded bowl + salad'], ['kids', '👦 Kids: beef + cheese + rice'], ['fish', '🐟 Mom: shrimp bowl']], shop: [['Ground beef 85/15', '1 lb', 7, 'proteins'], ['Black beans (can)', '2', 3, 'pantry']] }
    ],
    kidsFav: [
      { t: 'Homemade Chicken Tenders + Oven Sweet Potato Fries', badges: [['kids', '👦 Kids’ favorite']], steps: ['Chicken strips → egg → seasoned breadcrumbs → bake 425°F, 18 min', 'Sweet potato fries: thin slices, oil + salt, same oven 20 min (in first)', 'Dipping sauces: ketchup, honey mustard'], who: [['dad', '🥩 Dad: tenders + big salad'], ['kids', '👦 Kids: absolute favorite!'], ['fish', '🐟 Mom: tilapia fillet (same oven) + fries']], shop: [['Chicken breast (tenders)', '1.5 lb', 9, 'proteins'], ['Sweet potatoes', '2 lb', 4, 'produce']] },
      { t: 'Mini Cheeseburgers + Oven Fries', badges: [['kids', '👦 Kids’ favorite']], steps: ['Form small patties, griddle 3 min/side, melt cheese', 'Oven fries: potatoes, oil + salt, 425°F, 25 min', 'Kids build with cheese + ketchup'], who: [['dad', '🥩 Dad: double patty + salad'], ['kids', '👦 Kids build own'], ['fish', '🐟 Mom: salmon burger (no bun)']], shop: [['Ground beef 85/15', '1.5 lb', 10, 'proteins'], ['Slider buns', '1 pack', 3, 'pantry'], ['Russet potatoes', '2 lb', 3, 'produce']] },
      { t: 'Baked Mac & Cheese + Roasted Broccoli', badges: [['kids', '👦 Kids’ favorite']], steps: ['Classic baked mac & cheese — kids’ dream night', 'Roast broccoli on the side so there’s a veg', 'Mom: add shrimp to her portion'], who: [['dad', '🥩 Dad: mac + grilled chicken on top'], ['kids', '👦 Kids: cheesy heaven'], ['fish', '🐟 Mom: mac + shrimp']], shop: [['Elbow pasta', '1 lb', 2, 'pantry'], ['Broccoli crowns', '1 head', 2, 'produce']] }
    ],
    pizza: [
      { t: '🍕 Homemade Pizza Night — Everyone Builds Their Own', badges: [['pizza', '🍕 Pizza Night'], ['prep', 'Weekend — more time']], steps: ['Make dough in the afternoon (yeast + warm water + sugar → flour + salt + oil; rise 1-2 hrs)', 'Divide dough: 1 big for dad, 1 medium for mom, 3 small for kids', 'Each person spreads sauce + picks toppings', 'Bake 475-500°F, 8-10 min on a preheated sheet or stone'], who: [['all', '✅ All eat — everyone loves this'], ['kids', '👦 Kids build their own = no complaints'], ['fish', '🐟 Mom: shrimp + veggie pizza']], shop: [], tip: 'The weekly tradition — let the 7-year-old stretch their own dough round.' }
    ]
  };

  // Monday..Sunday rhythm (the family’s fixed traditions; dishes vary within each slot)
  const RHYTHM = [
    { day: 'Monday', cat: 'chicken', badges: [['prep', 'Batch night']] },
    { day: 'Tuesday', cat: 'fish', badges: [['fish', '🐟 Fish Night']] },
    { day: 'Wednesday', cat: 'taco', badges: [['kids', '👦 Kids build their own']] },
    { day: 'Thursday', cat: 'fish', badges: [['fish', '🐟 Fish Night']] },
    { day: 'Friday', cat: 'kidsFav', badges: [['kids', '👦 Kids’ favorite']] },
    { day: 'Saturday', cat: 'pizza', badges: [['pizza', '🍕 Pizza Night']] },
    { day: 'Sunday', cat: 'fish', badges: [['fish', '🐟 Fish Night'], ['prep', 'Prep Day']] }
  ];

  const SNACK_AM = [
    ['🍎', 'Apple slices + peanut butter', 'Protein + fiber — keeps them full until lunch'],
    ['🧀', 'String cheese + grapes', 'Grab-and-go, no prep'],
    ['🥚', 'Hard-boiled egg + banana', 'Use the batch you boiled earlier — peel and serve'],
    ['🫐', 'Yogurt cup + berries', 'Greek yogurt cup with a handful of blueberries'],
    ['🥞', 'Mini protein pancake (leftover)', 'Any leftover from the batch — reheat 30 seconds'],
    ['🍌', 'Banana + granola', 'Simple, filling, no prep']
  ];
  const SNACK_PM = [
    ['🥕', 'Baby carrots + ranch or hummus', 'Pre-portion into little cups — kids eat more when ready'],
    ['🧇', 'Crackers + cheese slices', 'Whole grain crackers with a couple slices of cheddar'],
    ['🍓', 'Fruit pouch + cheese stick', 'Perfectly portioned — the little one can self-serve'],
    ['🌽', 'Celery + peanut butter (ants on a log)', 'Raisins on peanut-butter celery'],
    ['🍏', 'Apple + string cheese', 'Sweet + protein, zero prep'],
    ['🥨', 'Whole grain pretzels + hummus', 'Crunchy and filling before active play']
  ];
  const TIPS = [
    ['Sunday Prep (30 min)', 'Hard-boil 6 eggs, marinate the next chicken, roast a double batch of veggies. Cuts active cooking on your hardest weeknights to nearly zero.'],
    ['Dad’s OMAD Strategy', 'Every dinner is protein-forward and sized up for you. Add an extra serving of protein and pile on the roasted vegetables — one great meal a day, make it count.'],
    ['Kid Picky-Eater Hack', 'Autonomy kills complaints. Taco night, pizza build, and tenders + dipping all let them choose — they eat more when they built it themselves.'],
    ['Mom’s Pescatarian Nights', 'On chicken/beef nights, a 6-8 oz piece of fish goes in the same oven, same temp. 5 extra minutes, zero extra dishes, no separate "mom meal" drama.'],
    ['Snack Prep Shortcut', 'Monday morning: wash all fruit, fill 5 small containers with carrots + hummus, set out cheese sticks. Done for the week.'],
    ['Freshness Order', 'Use asparagus and fresh greens early. Bell peppers, broccoli, zucchini hold all week. The prep-day roast cleans up whatever remains.'],
    ['Kroger App', 'Check digital coupons before shopping. Salmon, chicken, and shrimp rotate through deals — that alone can save $15-25/week.']
  ];

  // Stable staples that appear most weeks (prices used for the budget estimate)
  const PRODUCE_STAPLES = [
    ['Bananas', '1 bunch', 2], ['Strawberries or blueberries', '2 pints', 9], ['Grapes', '1.5 lb bag', 4],
    ['Apples', '3 lb bag', 5], ['Baby carrots', '2 lb bag', 4], ['Celery', '1 bunch', 2],
    ['Avocados', '3', 4], ['Lemons', '4', 3], ['Garlic', '1 head', 1], ['Mixed greens', '1 bag', 4]
  ];
  const DAIRY = [
    ['Greek yogurt (plain)', '32 oz', 7], ['Shredded cheddar', '16 oz', 6], ['Shredded mozzarella', '16 oz', 6],
    ['Parmesan (grated)', 'small', 5], ['Butter (unsalted)', '1 lb', 5], ['Milk (whole)', '1 gallon', 4], ['Sour cream', '8 oz', 3]
  ];
  const PIZZA_STAPLES = [
    ['All-purpose flour', '5 lb bag', 4], ['Active dry yeast', '3-pack', 3], ['Pizza/marinara sauce', '24 oz', 4],
    ['Pepperoni', '6 oz', 4], ['Fresh mozzarella', '8 oz ball', 5]
  ];
  const PANTRY = [
    ['Pasta', '2 lb', 4], ['White rice', '2 lb', 4], ['Flour tortillas (8 ct)', '2 packs', 6], ['Taco seasoning', '1 pkt', 2],
    ['Salsa', '16 oz', 4], ['Whole grain bread', '1 loaf', 4], ['Breadcrumbs', '1 canister', 3], ['Canned tomato soup', '2 cans', 4],
    ['Granola', '12 oz', 5], ['Rolled oats', '42 oz', 5], ['Honey', '12 oz', 5], ['Peanut butter', '16 oz', 5],
    ['Whole grain crackers', '1 box', 4], ['Soy sauce', 'small', 3], ['Hummus', '10 oz', 4], ['Eggs (large)', '2 dozen', 8], ['Turkey bacon', '1 pkg', 5]
  ];
  const SNACK_ITEMS = [
    ['String cheese sticks', '12 ct', 6], ['Fruit pouches', '8 ct', 6], ['Ranch dressing', 'small', 3], ['Raisins', 'small box', 3]
  ];
  const SAMS = [
    ['Frozen shrimp (bulk)', '3-5 lb', '~$30'], ['Frozen chicken breast', '6-8 lb', '~$22'], ['Greek yogurt multipack', 'cups', '~$15'],
    ['Eggs (3 dozen)', '36 ct', '~$12'], ['Olive oil (jug)', '2 L', '~$16'], ['Rice (large bag)', '25 lb', '~$18'],
    ['String cheese (bulk)', '48 ct', '~$14'], ['Fruit pouches (bulk)', '30+ ct', '~$18'], ['Peanut butter (2-pack)', '2×40 oz', '~$12']
  ];

  // ---- helpers ----
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = (a, i) => a[((i % a.length) + a.length) % a.length];
  function upcomingMonday() { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7)); return d; }
  function badge(cls, txt) { return `<span class="badge badge-${cls}">${esc(txt)}</span>`; }
  function whoRow(who) { return who && who.length ? `<div class="who-note">${who.map(w => badge(w[0], w[1])).join('')}</div>` : ''; }
  function mealRow(label, dish, extraDad) {
    if (!dish) return '';
    const detail = (dish.d || dish.steps || []).map(l => `<span>${esc(l)}</span>`).join('');
    return `<div class="meal-row"><div class="meal-label">${label}</div><div class="meal-content">
      <div class="meal-title">${esc(dish.t)}</div>
      <div class="meal-detail">${detail}</div>
      ${whoRow(dish.who)}${dish.dad ? `<em style="font-size:.78rem;color:#888;margin-top:4px;display:block;">${esc(dish.dad)}</em>` : ''}
      ${dish.tip ? `<div class="tip">💡 ${esc(dish.tip)}</div>` : ''}
    </div></div>`;
  }

  // ---- build a plan (deterministic from rot) ----
  function buildMealPlan(rot, weekOfISO) {
    const mon = weekOfISO ? new Date(weekOfISO + 'T00:00:00') : upcomingMonday();
    const fish = [pick(DINNERS.fish, rot), pick(DINNERS.fish, rot + 1), pick(DINNERS.fish, rot + 2)];   // 3 distinct fish nights
    let fi = 0;
    const days = RHYTHM.map((r, i) => {
      let dinner;
      if (r.cat === 'fish') dinner = fish[fi++];
      else dinner = pick(DINNERS[r.cat], rot + i);
      const isWeekend = (r.day === 'Saturday' || r.day === 'Sunday');
      const breakfast = (r.day === 'Saturday') ? WEEKEND_BREAKFAST : pick(BREAKFASTS, rot + i);
      const lunch = pick(LUNCHES, rot + i * 2);
      return { day: r.day, badges: r.badges, breakfast, lunch, dinner };
    });

    // shopping list: proteins/produce from chosen dinners + stable staples
    const proteins = [], produceDyn = [], pantryDyn = [];
    const seen = {};
    days.forEach(d => (d.dinner.shop || []).forEach(it => {
      const [name, qty, price, cat] = it;
      const key = cat + '|' + name;
      if (seen[key]) return; seen[key] = 1;
      const row = [name, qty, price];
      if (cat === 'proteins') proteins.push(row);
      else if (cat === 'produce') produceDyn.push(row);
      else if (cat === 'pantry') pantryDyn.push(row);
    }));
    proteins.push(['Eggs (large)', '2 dozen', 8], ['Turkey bacon', '1 pkg', 5]);
    const produce = produceDyn.concat(PRODUCE_STAPLES);
    const pantry = PANTRY.concat(pantryDyn);

    const sum = arr => arr.reduce((s, r) => s + (typeof r[2] === 'number' ? r[2] : 0), 0);
    const budget = {
      proteins: sum(proteins), produce: sum(produce), dairy: sum(DAIRY),
      pizza: sum(PIZZA_STAPLES), pantry: sum(pantry), snacks: sum(SNACK_ITEMS)
    };
    budget.total = budget.proteins + budget.produce + budget.dairy + budget.pizza + budget.pantry + budget.snacks;

    const snackAM = [0, 1, 2, 3].map(k => pick(SNACK_AM, rot + k));
    const snackPM = [0, 1, 2, 3].map(k => pick(SNACK_PM, rot + k + 2));
    const tips = [0, 1, 2, 3, 4, 5].map(k => pick(TIPS, k));   // tips are stable/rotated lightly

    return { rot, mon, days, snackAM, snackPM, tips, shop: { proteins, produce, dairy: DAIRY, pizza: PIZZA_STAPLES, pantry, snacks: SNACK_ITEMS, sams: SAMS }, budget };
  }

  // ---- render a plan to a full HTML document ----
  function mealPlanHTML(plan) {
    const mon = plan.mon, sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    const monthDay = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const rangeTxt = `Week of ${monthDay(mon)}–${monthDay(sun)}, ${sun.getFullYear()}`;

    const daysHtml = plan.days.map(d => `
      <div class="day-card">
        <div class="day-header"><h2>${esc(d.day)}</h2><div class="day-badges">${d.badges.map(b => badge(b[0], b[1])).join('')}</div></div>
        ${mealRow('Breakfast', d.breakfast)}
        ${mealRow('Lunch', d.lunch)}
        ${mealRow('Dinner', d.dinner)}
      </div>`).join('');

    const snackCard = (cls, header, items) => `
      <div class="snack-card ${cls}"><div class="snack-card-header">${header}</div><div class="snack-items">
        ${items.map(s => `<div class="snack-item"><span class="snack-emoji">${s[0]}</span><div class="snack-text"><strong>${esc(s[1])}</strong><span>${esc(s[2])}</span></div></div>`).join('')}
      </div></div>`;

    const shopCat = (cls, header, items) => `
      <div class="shop-category ${cls}"><div class="shop-cat-header">${header}</div><div class="shop-items">
        ${items.map(it => `<div class="shop-item"><span class="shop-item-name">${esc(it[0])}</span><span class="shop-item-qty">${esc(it[1])}</span><span class="shop-item-price">${typeof it[2] === 'number' ? '$' + it[2] : esc(it[2])}</span></div>`).join('')}
      </div></div>`;

    const b = plan.budget;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Family Meal Plan</title><style>${MEAL_CSS}</style></head><body>
      <h1>🥗 Sedlar Family Meal Plan</h1>
      <p class="subtitle">${rangeTxt} &nbsp;·&nbsp; Family of 5 &nbsp;·&nbsp; Budget: ~$${Math.round(b.total)}/week</p>
      <div class="key">
        <div class="key-item">${badge('fish', '🐟 Fish Night')} whole family eats fish</div>
        <div class="key-item">${badge('kids', '👦 Kids')} kid-friendly focus</div>
        <div class="key-item">${badge('dad', '🥩 Dad OMAD')} big dinner, skip breakfast</div>
        <div class="key-item">${badge('mom', 'Mom')} pescatarian swaps</div>
        <div class="key-item">${badge('pizza', '🍕 Pizza Night')} made from scratch</div>
      </div>
      <div class="strategy"><h2>♻️ This Week’s Rhythm</h2><ul>
        <li>3 fish nights (Tue, Thu, Sun) — whole family eats fish together</li>
        <li>Taco Wednesday + Pizza Saturday + kids’ favorite Friday = zero complaints</li>
        <li>Mom gets a fish swap on chicken/beef nights, same oven, same time</li>
        <li>Cook extra rice + roast a double batch of veg to reuse across the week</li>
        <li>Hard-boil eggs on prep day → breakfasts, snacks, and lunches all week</li>
      </ul></div>
      <div class="week-grid">${daysHtml}</div>
      <div class="snack-section"><h2>🍎 Kids’ Daily Snack Rotation</h2><div class="snack-grid">
        ${snackCard('snack-am', '☀️ Morning Snack (~10 AM)', plan.snackAM)}
        ${snackCard('snack-pm', '🌤 Afternoon Snack (~3 PM)', plan.snackPM)}
      </div></div>
      <div class="shop-section"><h2>🛒 Weekly Shopping List — Kroger + Sam’s Club</h2><div class="shop-grid">
        ${shopCat('sh-proteins', '🥩 Proteins', plan.shop.proteins)}
        ${shopCat('sh-produce', '🥦 Produce', plan.shop.produce)}
        ${shopCat('sh-dairy', '🧀 Dairy', plan.shop.dairy)}
        ${shopCat('sh-pizza', '🍕 Pizza Night', plan.shop.pizza)}
        ${shopCat('sh-pantry', '🏪 Pantry & Dry Goods', plan.shop.pantry)}
        ${shopCat('sh-snacks', '🍎 Kids’ Snacks', plan.shop.snacks)}
        ${shopCat('sh-sams', '🏬 Sam’s Club (Monthly Bulk)', plan.shop.sams)}
      </div>
      <div class="budget-box"><h3>💰 Weekly Budget Estimate</h3><div class="budget-rows">
        <div class="budget-row"><span>Proteins</span><span>~$${b.proteins}</span></div>
        <div class="budget-row"><span>Produce</span><span>~$${b.produce}</span></div>
        <div class="budget-row"><span>Dairy</span><span>~$${b.dairy}</span></div>
        <div class="budget-row"><span>Pizza Staples</span><span>~$${b.pizza}</span></div>
        <div class="budget-row"><span>Pantry &amp; Dry Goods</span><span>~$${b.pantry}</span></div>
        <div class="budget-row"><span>Kids’ Snacks</span><span>~$${b.snacks}</span></div>
        <div class="budget-row budget-total"><span>Estimated Weekly Total (Kroger)</span><span>~$${Math.round(b.total)}</span></div>
        <div class="budget-row" style="font-size:.8rem;color:#888;"><span>Sam’s Club bulk staples amortize across the month — weekly cost drops after the first shop</span><span></span></div>
      </div></div>
      </div>
      <div class="tips-section"><h2>⚡ Quick Tips for the Week</h2><div class="tips-grid">
        ${plan.tips.map(t => `<div class="tip-card"><h4>${esc(t[0])}</h4><p>${esc(t[1])}</p></div>`).join('')}
      </div></div>
    </body></html>`;
  }

  // ---- public API (globals used by index.html) ----
  window.buildMealPlan = buildMealPlan;
  window.mealPlanHTML = mealPlanHTML;

  window.renderMeals = function () {
    const f = document.getElementById('meal-frame');
    if (!f) return;
    const mp = (typeof appData !== 'undefined') ? appData.mealPlan : null;
    if (mp && mp.rot) {
      f.removeAttribute('src');
      f.srcdoc = mealPlanHTML(buildMealPlan(mp.rot, mp.weekOf));
    } else if (!f.getAttribute('src') && !f.srcdoc) {
      f.setAttribute('src', './meal-plan.html');   // fall back to the original hand-made plan until first generate
    }
  };

  window.generateMealPlan = function () {
    if (typeof appData === 'undefined') return;
    const rot = ((appData.mealPlan && appData.mealPlan.rot) || 0) + 1;
    const mon = upcomingMonday();
    appData.mealPlan = { rot, weekOf: mon.toISOString().slice(0, 10) };
    if (typeof saveData === 'function') saveData(appData);
    window.renderMeals();
    const monthDay = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (typeof showMessage === 'function') showMessage('meal-message', 'success', `✓ Fresh plan generated for the week of ${monthDay}`);
  };

  window.printMealPlan = function () {
    const mp = (typeof appData !== 'undefined') ? appData.mealPlan : null;
    const html = mp && mp.rot ? mealPlanHTML(buildMealPlan(mp.rot, mp.weekOf)) : null;
    const w = window.open('', '_blank');
    if (!w) return;
    if (html) { w.document.open(); w.document.write(html); w.document.close(); }
    else { const f = document.getElementById('meal-frame'); if (f) { w.location = f.src || './meal-plan.html'; } }
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 700);
  };

})();
