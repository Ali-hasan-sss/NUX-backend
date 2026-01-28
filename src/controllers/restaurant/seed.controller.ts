// src/controllers/restaurant/seed.controller.ts
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample data for seeding
const seedData = {
  categories: [
    {
      title: 'Appetizers',
      description: 'Start your meal with our delicious appetizers',
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop',
      items: [
        {
          title: 'Bruschetta',
          description: 'Toasted bread topped with fresh tomatoes, basil, and garlic',
          price: 8.99,
          image: 'https://images.unsplash.com/photo-1572441713132-51c75654db73?w=800&h=600&fit=crop',
          preparationTime: 10,
          calories: 180,
          allergies: ['Gluten', 'Dairy'],
          extras: [
            { name: 'Extra Cheese', price: 2.00, calories: 50 },
            { name: 'Olive Tapenade', price: 1.50, calories: 30 },
          ],
        },
        {
          title: 'Mozzarella Sticks',
          description: 'Crispy fried mozzarella with marinara sauce',
          price: 9.99,
          image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop',
          preparationTime: 12,
          calories: 320,
          allergies: ['Gluten', 'Dairy'],
          extras: [
            { name: 'Extra Marinara', price: 0.50, calories: 10 },
            { name: 'Ranch Dressing', price: 1.00, calories: 80 },
          ],
        },
        {
          title: 'Chicken Wings',
          description: 'Spicy buffalo wings served with blue cheese dip',
          price: 12.99,
          image: 'https://images.unsplash.com/photo-1527477396000-e27137b2c8e8?w=800&h=600&fit=crop',
          preparationTime: 20,
          calories: 450,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Hot Sauce', price: 0.50, calories: 5 },
            { name: 'Celery Sticks', price: 1.00, calories: 10 },
          ],
        },
        {
          title: 'Spring Rolls',
          description: 'Crispy vegetable spring rolls with sweet chili sauce',
          price: 7.99,
          image: 'https://images.unsplash.com/photo-1585032226651-759b0d11d870?w=800&h=600&fit=crop',
          preparationTime: 15,
          calories: 200,
          allergies: [],
          extras: [
            { name: 'Extra Sauce', price: 0.50, calories: 20 },
            { name: 'Peanut Sauce', price: 1.00, calories: 60 },
          ],
        },
        {
          title: 'Shrimp Cocktail',
          description: 'Fresh shrimp served with cocktail sauce and lemon',
          price: 14.99,
          image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop',
          preparationTime: 8,
          calories: 150,
          allergies: ['Shellfish'],
          extras: [
            { name: 'Extra Cocktail Sauce', price: 0.50, calories: 15 },
            { name: 'Avocado', price: 2.00, calories: 80 },
          ],
        },
        {
          title: 'Stuffed Mushrooms',
          description: 'Mushrooms filled with cream cheese and herbs',
          price: 10.99,
          image: 'https://images.unsplash.com/photo-1563379091339-03246963d96a?w=800&h=600&fit=crop',
          preparationTime: 18,
          calories: 220,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Cheese', price: 1.50, calories: 50 },
            { name: 'Bacon Bits', price: 2.00, calories: 60 },
          ],
        },
        {
          title: 'Nachos',
          description: 'Tortilla chips topped with cheese, jalapeños, and sour cream',
          price: 11.99,
          image: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=800&h=600&fit=crop',
          preparationTime: 12,
          calories: 480,
          allergies: ['Gluten', 'Dairy'],
          extras: [
            { name: 'Extra Cheese', price: 2.00, calories: 100 },
            { name: 'Guacamole', price: 2.50, calories: 120 },
            { name: 'Sour Cream', price: 1.00, calories: 60 },
          ],
        },
        {
          title: 'Onion Rings',
          description: 'Crispy beer-battered onion rings',
          price: 8.99,
          image: 'https://images.unsplash.com/photo-1615367423053-4ec5b0b5c5b5?w=800&h=600&fit=crop',
          preparationTime: 10,
          calories: 350,
          allergies: ['Gluten'],
          extras: [
            { name: 'Ranch Dressing', price: 1.00, calories: 80 },
            { name: 'BBQ Sauce', price: 0.50, calories: 25 },
          ],
        },
        {
          title: 'Calamari',
          description: 'Fried squid rings with marinara sauce',
          price: 13.99,
          image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop',
          preparationTime: 15,
          calories: 280,
          allergies: ['Shellfish', 'Gluten'],
          extras: [
            { name: 'Lemon Wedges', price: 0.00, calories: 0 },
            { name: 'Aioli', price: 1.50, calories: 90 },
          ],
        },
        {
          title: 'Hummus & Pita',
          description: 'Creamy hummus served with warm pita bread',
          price: 9.99,
          image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 250,
          allergies: ['Gluten', 'Sesame'],
          extras: [
            { name: 'Extra Pita', price: 1.50, calories: 80 },
            { name: 'Olive Oil Drizzle', price: 0.50, calories: 40 },
          ],
        },
      ],
    },
    {
      title: 'Main Courses',
      description: 'Our signature main dishes',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
      items: [
        {
          title: 'Grilled Salmon',
          description: 'Fresh Atlantic salmon with lemon butter sauce and vegetables',
          price: 24.99,
          image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop',
          preparationTime: 25,
          calories: 450,
          allergies: ['Fish'],
          extras: [
            { name: 'Extra Vegetables', price: 3.00, calories: 50 },
            { name: 'Side Salad', price: 4.00, calories: 100 },
          ],
        },
        {
          title: 'Ribeye Steak',
          description: '12oz prime ribeye cooked to perfection with mashed potatoes',
          price: 32.99,
          image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&h=600&fit=crop',
          preparationTime: 30,
          calories: 680,
          allergies: [],
          extras: [
            { name: 'Mushroom Sauce', price: 2.50, calories: 80 },
            { name: 'Peppercorn Sauce', price: 2.50, calories: 90 },
            { name: 'Garlic Butter', price: 1.50, calories: 100 },
          ],
        },
        {
          title: 'Chicken Parmesan',
          description: 'Breaded chicken breast with marinara and mozzarella, served with pasta',
          price: 18.99,
          image: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&h=600&fit=crop',
          preparationTime: 28,
          calories: 720,
          allergies: ['Gluten', 'Dairy'],
          extras: [
            { name: 'Extra Cheese', price: 2.00, calories: 100 },
            { name: 'Side Caesar Salad', price: 4.00, calories: 150 },
          ],
        },
        {
          title: 'Beef Burger',
          description: 'Angus beef patty with lettuce, tomato, onion, and special sauce',
          price: 15.99,
          image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=600&fit=crop',
          preparationTime: 20,
          calories: 650,
          allergies: ['Gluten', 'Dairy'],
          extras: [
            { name: 'Bacon', price: 2.50, calories: 80 },
            { name: 'Avocado', price: 2.00, calories: 100 },
            { name: 'Fried Egg', price: 1.50, calories: 70 },
            { name: 'Extra Cheese', price: 1.50, calories: 80 },
          ],
        },
        {
          title: 'Pasta Carbonara',
          description: 'Creamy pasta with bacon, eggs, and parmesan cheese',
          price: 16.99,
          image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop',
          preparationTime: 22,
          calories: 580,
          allergies: ['Gluten', 'Dairy', 'Eggs'],
          extras: [
            { name: 'Extra Bacon', price: 2.00, calories: 60 },
            { name: 'Extra Cheese', price: 1.50, calories: 80 },
          ],
        },
        {
          title: 'Fish & Chips',
          description: 'Beer-battered cod with crispy fries and tartar sauce',
          price: 17.99,
          image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=600&fit=crop',
          preparationTime: 25,
          calories: 750,
          allergies: ['Gluten', 'Fish'],
          extras: [
            { name: 'Extra Tartar Sauce', price: 0.50, calories: 50 },
            { name: 'Mushy Peas', price: 2.00, calories: 80 },
          ],
        },
        {
          title: 'BBQ Pulled Pork',
          description: 'Slow-cooked pulled pork with BBQ sauce, coleslaw, and fries',
          price: 19.99,
          image: 'https://images.unsplash.com/photo-1528607929212-2636ec44253e?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 620,
          allergies: [],
          extras: [
            { name: 'Extra BBQ Sauce', price: 0.50, calories: 30 },
            { name: 'Extra Coleslaw', price: 2.00, calories: 100 },
          ],
        },
        {
          title: 'Vegetarian Lasagna',
          description: 'Layers of pasta, vegetables, and cheese with marinara sauce',
          price: 16.99,
          image: 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=800&h=600&fit=crop',
          preparationTime: 35,
          calories: 520,
          allergies: ['Gluten', 'Dairy'],
          extras: [
            { name: 'Extra Cheese', price: 2.00, calories: 100 },
            { name: 'Side Garlic Bread', price: 3.00, calories: 150 },
          ],
        },
        {
          title: 'Lamb Chops',
          description: 'Grilled lamb chops with mint sauce and roasted vegetables',
          price: 28.99,
          image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&h=600&fit=crop',
          preparationTime: 30,
          calories: 550,
          allergies: [],
          extras: [
            { name: 'Extra Mint Sauce', price: 1.00, calories: 20 },
            { name: 'Side Rice', price: 2.50, calories: 150 },
          ],
        },
        {
          title: 'Chicken Tikka Masala',
          description: 'Tender chicken in creamy tomato curry sauce with basmati rice',
          price: 18.99,
          image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop',
          preparationTime: 30,
          calories: 580,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Rice', price: 2.00, calories: 150 },
            { name: 'Naan Bread', price: 3.00, calories: 200 },
          ],
        },
      ],
    },
    {
      title: 'Desserts',
      description: 'Sweet endings to your meal',
      image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop',
      items: [
        {
          title: 'Chocolate Lava Cake',
          description: 'Warm chocolate cake with molten center, served with vanilla ice cream',
          price: 9.99,
          image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&h=600&fit=crop',
          preparationTime: 15,
          calories: 480,
          allergies: ['Gluten', 'Dairy', 'Eggs'],
          extras: [
            { name: 'Extra Ice Cream', price: 2.00, calories: 120 },
            { name: 'Whipped Cream', price: 1.00, calories: 50 },
          ],
        },
        {
          title: 'Cheesecake',
          description: 'New York style cheesecake with berry compote',
          price: 8.99,
          image: 'https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 420,
          allergies: ['Gluten', 'Dairy', 'Eggs'],
          extras: [
            { name: 'Extra Berries', price: 1.50, calories: 30 },
            { name: 'Chocolate Sauce', price: 1.00, calories: 60 },
          ],
        },
        {
          title: 'Tiramisu',
          description: 'Classic Italian dessert with coffee-soaked ladyfingers and mascarpone',
          price: 9.99,
          image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 380,
          allergies: ['Gluten', 'Dairy', 'Eggs'],
          extras: [
            { name: 'Extra Cocoa', price: 0.50, calories: 10 },
            { name: 'Coffee Shot', price: 2.00, calories: 5 },
          ],
        },
        {
          title: 'Apple Pie',
          description: 'Homemade apple pie with cinnamon and vanilla ice cream',
          price: 7.99,
          image: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=800&h=600&fit=crop',
          preparationTime: 10,
          calories: 420,
          allergies: ['Gluten', 'Dairy'],
          extras: [
            { name: 'Extra Ice Cream', price: 2.00, calories: 120 },
            { name: 'Caramel Sauce', price: 1.00, calories: 80 },
          ],
        },
        {
          title: 'Ice Cream Sundae',
          description: 'Three scoops of vanilla ice cream with hot fudge and nuts',
          price: 8.99,
          image: 'https://images.unsplash.com/photo-1563805042-7684c019e1b5?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 450,
          allergies: ['Dairy', 'Nuts'],
          extras: [
            { name: 'Extra Fudge', price: 1.00, calories: 100 },
            { name: 'Whipped Cream', price: 1.00, calories: 50 },
            { name: 'Cherry', price: 0.50, calories: 5 },
          ],
        },
        {
          title: 'Crème Brûlée',
          description: 'Classic French custard with caramelized sugar top',
          price: 8.99,
          image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 320,
          allergies: ['Dairy', 'Eggs'],
          extras: [
            { name: 'Fresh Berries', price: 1.50, calories: 30 },
            { name: 'Extra Sugar', price: 0.00, calories: 0 },
          ],
        },
        {
          title: 'Brownie Sundae',
          description: 'Warm chocolate brownie with ice cream and chocolate sauce',
          price: 9.99,
          image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&h=600&fit=crop',
          preparationTime: 8,
          calories: 520,
          allergies: ['Gluten', 'Dairy', 'Eggs'],
          extras: [
            { name: 'Extra Ice Cream', price: 2.00, calories: 120 },
            { name: 'Nuts', price: 1.50, calories: 80 },
          ],
        },
        {
          title: 'Key Lime Pie',
          description: 'Tangy key lime pie with graham cracker crust',
          price: 8.99,
          image: 'https://images.unsplash.com/photo-1621303837174-89787a7d4729?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 380,
          allergies: ['Gluten', 'Dairy', 'Eggs'],
          extras: [
            { name: 'Whipped Cream', price: 1.00, calories: 50 },
            { name: 'Lime Zest', price: 0.00, calories: 0 },
          ],
        },
        {
          title: 'Chocolate Mousse',
          description: 'Rich and creamy chocolate mousse topped with chocolate shavings',
          price: 8.99,
          image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 350,
          allergies: ['Dairy', 'Eggs'],
          extras: [
            { name: 'Extra Chocolate', price: 1.00, calories: 60 },
            { name: 'Fresh Berries', price: 1.50, calories: 30 },
          ],
        },
        {
          title: 'Strawberry Shortcake',
          description: 'Layers of sponge cake, fresh strawberries, and whipped cream',
          price: 9.99,
          image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop',
          preparationTime: 8,
          calories: 420,
          allergies: ['Gluten', 'Dairy', 'Eggs'],
          extras: [
            { name: 'Extra Strawberries', price: 1.50, calories: 20 },
            { name: 'Extra Cream', price: 1.00, calories: 80 },
          ],
        },
      ],
    },
    {
      title: 'Beverages',
      description: 'Refreshing drinks to complement your meal',
      image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop',
      items: [
        {
          title: 'Fresh Orange Juice',
          description: 'Freshly squeezed orange juice',
          price: 4.99,
          image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800&h=600&fit=crop',
          preparationTime: 3,
          calories: 110,
          allergies: [],
          extras: [
            { name: 'Extra Ice', price: 0.00, calories: 0 },
            { name: 'Sparkling Water', price: 1.00, calories: 0 },
          ],
        },
        {
          title: 'Iced Coffee',
          description: 'Cold brew coffee served over ice',
          price: 5.99,
          image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 15,
          allergies: [],
          extras: [
            { name: 'Extra Shot', price: 1.50, calories: 5 },
            { name: 'Milk', price: 0.50, calories: 20 },
            { name: 'Vanilla Syrup', price: 0.75, calories: 30 },
          ],
        },
        {
          title: 'Lemonade',
          description: 'Fresh lemonade with a hint of mint',
          price: 4.99,
          image: 'https://images.unsplash.com/photo-1523677011783-c91d1bbe2fdc?w=800&h=600&fit=crop',
          preparationTime: 3,
          calories: 120,
          allergies: [],
          extras: [
            { name: 'Extra Lemon', price: 0.50, calories: 5 },
            { name: 'Sparkling', price: 1.00, calories: 0 },
          ],
        },
        {
          title: 'Smoothie Bowl',
          description: 'Mixed berry smoothie bowl topped with granola and fruits',
          price: 8.99,
          image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&h=600&fit=crop',
          preparationTime: 8,
          calories: 280,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Berries', price: 1.50, calories: 30 },
            { name: 'Honey Drizzle', price: 0.50, calories: 40 },
          ],
        },
        {
          title: 'Milkshake',
          description: 'Creamy vanilla milkshake with whipped cream',
          price: 6.99,
          image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 380,
          allergies: ['Dairy'],
          extras: [
            { name: 'Chocolate Flavor', price: 0.50, calories: 30 },
            { name: 'Strawberry Flavor', price: 0.50, calories: 20 },
            { name: 'Extra Whipped Cream', price: 1.00, calories: 50 },
          ],
        },
        {
          title: 'Iced Tea',
          description: 'Refreshing iced tea with lemon',
          price: 3.99,
          image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=600&fit=crop',
          preparationTime: 2,
          calories: 70,
          allergies: [],
          extras: [
            { name: 'Extra Lemon', price: 0.50, calories: 5 },
            { name: 'Peach Flavor', price: 0.75, calories: 15 },
          ],
        },
        {
          title: 'Hot Chocolate',
          description: 'Rich hot chocolate with marshmallows',
          price: 5.99,
          image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 320,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Marshmallows', price: 0.50, calories: 30 },
            { name: 'Whipped Cream', price: 1.00, calories: 50 },
          ],
        },
        {
          title: 'Fresh Mint Tea',
          description: 'Hot mint tea with fresh mint leaves',
          price: 4.99,
          image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 5,
          allergies: [],
          extras: [
            { name: 'Honey', price: 0.50, calories: 40 },
            { name: 'Lemon', price: 0.50, calories: 5 },
          ],
        },
        {
          title: 'Cappuccino',
          description: 'Espresso with steamed milk and foam',
          price: 5.99,
          image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 80,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Shot', price: 1.50, calories: 5 },
            { name: 'Cinnamon', price: 0.25, calories: 2 },
            { name: 'Cocoa Powder', price: 0.25, calories: 5 },
          ],
        },
        {
          title: 'Mojito (Non-Alcoholic)',
          description: 'Fresh mint, lime, and soda water',
          price: 6.99,
          image: 'https://images.unsplash.com/photo-1523677011783-c91d1bbe2fdc?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 50,
          allergies: [],
          extras: [
            { name: 'Extra Mint', price: 0.50, calories: 2 },
            { name: 'Extra Lime', price: 0.50, calories: 5 },
          ],
        },
      ],
    },
    {
      title: 'Salads',
      description: 'Fresh and healthy salad options',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
      items: [
        {
          title: 'Caesar Salad',
          description: 'Romaine lettuce with caesar dressing, croutons, and parmesan',
          price: 12.99,
          image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&h=600&fit=crop',
          preparationTime: 10,
          calories: 320,
          allergies: ['Gluten', 'Dairy', 'Eggs'],
          extras: [
            { name: 'Grilled Chicken', price: 4.00, calories: 180 },
            { name: 'Extra Parmesan', price: 1.50, calories: 60 },
          ],
        },
        {
          title: 'Greek Salad',
          description: 'Mixed greens with feta, olives, tomatoes, and cucumber',
          price: 11.99,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
          preparationTime: 8,
          calories: 280,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Feta', price: 2.00, calories: 80 },
            { name: 'Grilled Chicken', price: 4.00, calories: 180 },
          ],
        },
        {
          title: 'Cobb Salad',
          description: 'Mixed greens with chicken, bacon, eggs, avocado, and blue cheese',
          price: 14.99,
          image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
          preparationTime: 12,
          calories: 450,
          allergies: ['Dairy', 'Eggs'],
          extras: [
            { name: 'Extra Avocado', price: 2.00, calories: 100 },
            { name: 'Extra Bacon', price: 2.50, calories: 80 },
          ],
        },
        {
          title: 'Caprese Salad',
          description: 'Fresh mozzarella, tomatoes, and basil with balsamic glaze',
          price: 10.99,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
          preparationTime: 5,
          calories: 250,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Mozzarella', price: 2.00, calories: 100 },
            { name: 'Olive Oil Drizzle', price: 0.50, calories: 40 },
          ],
        },
        {
          title: 'Asian Chicken Salad',
          description: 'Mixed greens with grilled chicken, mandarin oranges, and sesame dressing',
          price: 13.99,
          image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&h=600&fit=crop',
          preparationTime: 10,
          calories: 380,
          allergies: ['Sesame'],
          extras: [
            { name: 'Extra Chicken', price: 3.00, calories: 150 },
            { name: 'Extra Oranges', price: 1.50, calories: 40 },
          ],
        },
        {
          title: 'Spinach Salad',
          description: 'Fresh spinach with strawberries, walnuts, and feta cheese',
          price: 11.99,
          image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
          preparationTime: 8,
          calories: 320,
          allergies: ['Dairy', 'Nuts'],
          extras: [
            { name: 'Extra Walnuts', price: 1.50, calories: 100 },
            { name: 'Extra Strawberries', price: 1.00, calories: 20 },
          ],
        },
        {
          title: 'Quinoa Salad',
          description: 'Quinoa with vegetables, feta, and lemon vinaigrette',
          price: 12.99,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
          preparationTime: 15,
          calories: 350,
          allergies: ['Dairy'],
          extras: [
            { name: 'Grilled Chicken', price: 4.00, calories: 180 },
            { name: 'Extra Feta', price: 2.00, calories: 80 },
          ],
        },
        {
          title: 'Waldorf Salad',
          description: 'Apples, celery, walnuts, and grapes with mayonnaise dressing',
          price: 10.99,
          image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&h=600&fit=crop',
          preparationTime: 8,
          calories: 280,
          allergies: ['Nuts', 'Eggs'],
          extras: [
            { name: 'Extra Walnuts', price: 1.50, calories: 100 },
            { name: 'Extra Grapes', price: 1.00, calories: 30 },
          ],
        },
        {
          title: 'Taco Salad',
          description: 'Lettuce with seasoned ground beef, cheese, and salsa',
          price: 13.99,
          image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
          preparationTime: 12,
          calories: 420,
          allergies: ['Dairy'],
          extras: [
            { name: 'Extra Cheese', price: 1.50, calories: 80 },
            { name: 'Sour Cream', price: 1.00, calories: 60 },
            { name: 'Guacamole', price: 2.50, calories: 120 },
          ],
        },
        {
          title: 'Mediterranean Salad',
          description: 'Mixed greens with olives, feta, tomatoes, and olive oil dressing',
          price: 11.99,
          image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
          preparationTime: 8,
          calories: 300,
          allergies: ['Dairy'],
          extras: [
            { name: 'Grilled Chicken', price: 4.00, calories: 180 },
            { name: 'Extra Olives', price: 1.50, calories: 40 },
          ],
        },
      ],
    },
  ],
};

/**
 * @swagger
 * /restaurants/menu/seed:
 *   post:
 *     summary: Seed sample menu data (categories and items)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Sample menu data seeded successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
export const seedMenuData = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Get restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
    }

    const createdCategories = [];
    const createdItems = [];

    // Create categories and items
    for (const categoryData of seedData.categories) {
      // Create category
      const category = await prisma.menuCategory.create({
        data: {
          restaurantId: restaurant.id,
          title: categoryData.title,
          description: categoryData.description,
          image: categoryData.image,
        },
      });

      createdCategories.push(category);

      // Create items for this category
      for (const itemData of categoryData.items) {
        const item = await prisma.menuItem.create({
          data: {
            categoryId: category.id,
            title: itemData.title,
            description: itemData.description,
            price: itemData.price,
            image: itemData.image,
            preparationTime: itemData.preparationTime,
            calories: itemData.calories,
            allergies: itemData.allergies,
            extras: itemData.extras,
          },
        });

        createdItems.push(item);
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully seeded ${createdCategories.length} categories and ${createdItems.length} items`,
      data: {
        categories: createdCategories.length,
        items: createdItems.length,
      },
    });
  } catch (err: any) {
    console.error('Error seeding menu data:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message,
    });
  }
};
