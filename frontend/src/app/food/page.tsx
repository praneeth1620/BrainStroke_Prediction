"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

type FoodItem = {
  id: number;
  name: string;
  category: string;
  description: string;
  nutrition_note: string;
};

export default function FoodPage() {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    async function load() {
      const response = await apiFetch<{ food_items: FoodItem[] }>('/food');
      setItems(response.food_items || []);
    }
    load();
  }, []);

  const categories = ["All", ...new Set(items.map((item) => item.category))];
  const filteredItems = filter === 'All' ? items : items.filter((item) => item.category === filter);

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Food & Lifestyle</p>
          <h1>Healthy eating guidance</h1>
        </div>
      </div>

      <section className="card-panel">
        <div className="filter-row">
          {categories.map((category) => (
            <button key={category} type="button" className={filter === category ? 'chip active' : 'chip'} onClick={() => setFilter(category)}>
              {category}
            </button>
          ))}
        </div>

        <div className="food-grid">
          {filteredItems.map((item) => (
            <article key={item.id} className="food-card">
              <h3>{item.name}</h3>
              <p className="muted">{item.category}</p>
              <p>{item.description}</p>
              <small>{item.nutrition_note}</small>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
