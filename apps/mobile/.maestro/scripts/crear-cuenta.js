// Crea una cuenta nueva contra la API para que cada flujo empiece sin datos previos.
// Corre en la computadora (no en el teléfono), así que localhost es la pila de Docker.
const email = 'maestro.' + Date.now() + '@example.com';
const password = 'Prueba12345';
const whatsapp = '+52155' + Math.floor(10000000 + Math.random() * 89999999);

const response = http.post(API_URL + '/auth/register', {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fullName: 'Persona Maestro', email: email, whatsapp: whatsapp, password: password }),
});
if (!response.ok) {
  throw new Error('No se pudo crear la cuenta de prueba (' + response.status + '): ' + response.body);
}

output.cuenta = { email: email, password: password };
