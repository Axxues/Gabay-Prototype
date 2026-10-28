import urllib.request
import urllib.error
import json

accounts = [
    ('admin', 'jayveegenetareyes@gmail.com', 'qwerty12345'),
    ('dean', 'dean1@dmmmsu.edu.ph', 'gabay2026'),
    ('chair', 'chair1@dmmmsu.edu.ph', 'gabay2026'),
    ('faculty', 'faculty1@dmmmsu.edu.ph', 'gabay2026'),
    ('staff', 'staff1@dmmmsu.edu.ph', 'gabay2026'),
    ('student', 'student1@dmmmsu.edu.ph', 'gabay2026'),
]

admin_headers = {'Authorization': 'Bearer zPcFhx76dgLG_PQP1pxP_myAuhBO1aZX', 'User-Agent': 'curl/8.5.0'}
req_a = urllib.request.Request('https://gabay.zyberlab.com/items/announcements?limit=-1', headers=admin_headers)
with urllib.request.urlopen(req_a) as resp:
    anns = json.loads(resp.read().decode())['data']
print(f'Total announcements in DB: {len(anns)}')
for a in anns:
    print('Announcement:', a.get('id'), a.get('title'), 'course_id:', a.get('course_id'))

for role, email, password in accounts:
    req_login = urllib.request.Request(
        'https://gabay.zyberlab.com/auth/login',
        data=json.dumps({'email': email, 'password': password}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': 'curl/8.5.0'},
        method='POST'
    )
    with urllib.request.urlopen(req_login) as resp:
        token = json.loads(resp.read().decode())['data']['access_token']

    req_me = urllib.request.Request('https://gabay.zyberlab.com/users/me', headers={'Authorization': f'Bearer {token}', 'User-Agent': 'curl/8.5.0'})
    with urllib.request.urlopen(req_me) as resp:
        me = json.loads(resp.read().decode())['data']

    for a in anns:
        ann_id = a['id']
        payload = {
            'announcement_id': ann_id,
            'author_id': me['id'],
            'author_name': f"{me.get('first_name','')} {me.get('last_name', '')}",
            'author_avatar': me.get('avatar'),
            'author_role': role,
            'content': f'Test reply from {role}',
            'created_at': '2026-10-28T14:40:00.000Z'
        }
        req_post = urllib.request.Request(
            'https://gabay.zyberlab.com/items/announcement_replies',
            data=json.dumps(payload).encode(),
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'User-Agent': 'curl/8.5.0'},
            method='POST'
        )
        try:
            with urllib.request.urlopen(req_post) as resp_post:
                res_data = json.loads(resp_post.read().decode())['data']
                reply_id = res_data['id']
                # Delete immediately
                req_del = urllib.request.Request(
                    f'https://gabay.zyberlab.com/items/announcement_replies/{reply_id}',
                    headers={'Authorization': f'Bearer {token}', 'User-Agent': 'curl/8.5.0'},
                    method='DELETE'
                )
                urllib.request.urlopen(req_del)
                print(f'Role {role} on {ann_id}: SUCCESS')
        except urllib.error.HTTPError as e:
            print(f'Role {role} on {ann_id}: FAILED {e.code}: {e.read().decode()}')
