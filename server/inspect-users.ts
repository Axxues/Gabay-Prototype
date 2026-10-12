async function run() {
  const loginRes = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jayveegenetareyes@gmail.com', password: 'qwerty12345' }),
  });
  const { token, user } = await loginRes.json();
  console.log('Session user ID:', user.id, user.name);

  const usersRes = await fetch('http://localhost:4001/api/users', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const json = await usersRes.json();
  console.log('Users count:', json.users?.length);
  for (const u of json.users || []) {
    console.log(`- [${u.id}] ${u.name} (${u.email}) [${u.role}]`);
  }
}
run();
