// Existing assessment tests focus on grading/timing. Supply their prerequisite
// subject enrollment explicitly; dedicated class tests exercise the join-code API.
exports.assignTestClass=async(pool,url,method,body)=>{
 const match=/^\/exams\/(\d+)\/status$/.exec(url);
 if(method!=='POST'||body?.status!=='published'||!match)return;
 const eid=Number(match[1]);
 if((await pool.query('SELECT 1 FROM exam_class_assignments WHERE exam_id=$1',[eid])).rows.length)return;
 const e=(await pool.query('SELECT * FROM exams WHERE id=$1',[eid])).rows[0];if(!e)return;
 const cl=(await pool.query('INSERT INTO exam_classes(instructor_id,name) VALUES($1,$2) RETURNING id',[e.instructor_id,'Assessment fixture '+eid])).rows[0];
 await pool.query('INSERT INTO exam_class_assignments(exam_id,class_id) VALUES($1,$2)',[eid,cl.id]);
 await pool.query("INSERT INTO class_students(class_id,student_id,joined_via_code) SELECT $1,id,TRUE FROM users WHERE role='student'",[cl.id]);
};
