export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteStop {
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
}

// Fórmula de Haversine para calcular distância entre duas coordenadas em KM
export function getDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371; // Raio da terra em KM
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Algoritmo do Vizinho Mais Próximo para ordenar a rota do motorista
export function optimizeRoute(
  driverHome: Coordinate,
  passengers: RouteStop[]
): RouteStop[] {
  const unvisited = [...passengers];
  const orderedRoute: RouteStop[] = [];
  
  let currentPosition = driverHome;

  while (unvisited.length > 0) {
    let closestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const passenger = unvisited[i];
      const distance = getDistance(currentPosition, {
        latitude: passenger.latitude,
        longitude: passenger.longitude,
      });

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    const nextStop = unvisited.splice(closestIndex, 1)[0];
    orderedRoute.push(nextStop);
    currentPosition = {
      latitude: nextStop.latitude,
      longitude: nextStop.longitude,
    };
  }

  return orderedRoute;
}
