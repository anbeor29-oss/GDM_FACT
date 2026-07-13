/**
 * ComingSoon — placeholder para módulos del plan ALMACEN aún no construidos
 * (Inventarios, Almacenes, Inventario físico, Compras, Órdenes de compra,
 * Tesorería). Deja la navegación y el gateo por grupo de trabajo completos
 * y demostrables mientras se implementa cada módulo.
 */
import { Construction } from 'lucide-react';

export function ComingSoon({
  title, description, bullets,
}: {
  title: string;
  description?: string;
  bullets?: string[];
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow border p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 rounded-2xl flex items-center justify-center">
          <Construction className="text-amber-500" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500 mt-1">Módulo en construcción</p>
        {description && <p className="text-gray-600 mt-4 max-w-md mx-auto">{description}</p>}
        {bullets && bullets.length > 0 && (
          <ul className="mt-5 text-left max-w-md mx-auto space-y-1.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-500 mt-0.5">▸</span> {b}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-400 mt-6">
          Tu grupo de trabajo tiene acceso a este módulo. Estará disponible en una próxima entrega.
        </p>
      </div>
    </div>
  );
}

export default ComingSoon;
