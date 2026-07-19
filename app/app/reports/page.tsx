import { redirect } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await requireYardUser();
  const yardId = ctx.yard.id;
  const since30 = new Date(Date.now() - 30 * 864e5);

  const [delivered30, online30, phone30, views30, topProducts] = await Promise.all([
    db.order.aggregate({
      where: { yardId, status: "DELIVERED", deliveredAt: { gte: since30 } },
      _sum: { totalCents: true },
      _count: true,
    }),
    db.order.count({ where: { yardId, channel: "ONLINE", createdAt: { gte: since30 }, status: { not: "CANCELED" } } }),
    db.order.count({ where: { yardId, channel: "PHONE", createdAt: { gte: since30 }, status: { not: "CANCELED" } } }),
    db.eventLog.count({ where: { yardId, type: "storefront_view", createdAt: { gte: since30 } } }),
    db.orderItem.groupBy({
      by: ["nameSnap"],
      where: { order: { yardId, createdAt: { gte: since30 }, status: { not: "CANCELED" } } },
      _sum: { qty: true, totalCents: true },
      orderBy: { _sum: { totalCents: "desc" } },
      take: 8,
    }),
  ]);

  const totalOrders = online30 + phone30;
  const onlineShare = totalOrders > 0 ? Math.round((online30 / totalOrders) * 100) : 0;

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Reports — last 30 days</h1>
        <a className="btn secondary" href="/app/reports/export">
          Download QuickBooks CSV
        </a>
      </div>

      <div className="grid4">
        <div className="card statcard">
          <div className="num">{formatCents(delivered30._sum.totalCents ?? 0)}</div>
          <div className="lbl">Delivered revenue</div>
        </div>
        <div className="card statcard">
          <div className="num">{delivered30._count}</div>
          <div className="lbl">Deliveries</div>
        </div>
        <div className="card statcard">
          <div className="num">{onlineShare}%</div>
          <div className="lbl">Orders online</div>
        </div>
        <div className="card statcard">
          <div className="num">{views30}</div>
          <div className="lbl">Storefront visits</div>
        </div>
      </div>

      <div className="card">
        <h2>Top products</h2>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="right">Qty sold</th>
              <th className="right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p) => (
              <tr key={p.nameSnap}>
                <td>{p.nameSnap}</td>
                <td className="right">{p._sum.qty}</td>
                <td className="right">{formatCents(p._sum.totalCents ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Channel mix</h2>
        <p>
          Online orders: <strong>{online30}</strong> · Phone orders: <strong>{phone30}</strong>
        </p>
        <p className="muted">
          Every order that comes in online instead of by phone is counter time back in your day.
        </p>
      </div>
    </div>
  );
}
