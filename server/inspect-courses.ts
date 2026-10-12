import './src/env.js';
import { getAllCourses } from './src/likha/repositories/coursesRepo.js';

async function run() {
  const likhaCourses = await getAllCourses();
  console.log('Likha Courses:');
  for (const c of likhaCourses) {
    console.log(`- [${c.id}] ${c.code}: ${c.title} (Instructor: ${c.instructorId} / ${c.instructorName})`);
  }
}
run();
