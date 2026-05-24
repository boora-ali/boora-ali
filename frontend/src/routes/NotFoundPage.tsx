import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
          Página não encontrada
        </h2>
        <p className="text-gray-500 mb-6 max-w-md">
          O recurso que você está procurando não existe.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <Button onClick={() => navigate("/places")}>
            Ir para lugares
          </Button>
        </div>
      </div>
    </div>
  );
}
