package dbqueries

const ProjectEnumLabels = `SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = $1 ORDER BY e.enumsortorder`

const ProjectsSelectIDsBase = `SELECT p.id FROM projects p`

const UpdateRankByColumnPrefix = `UPDATE ranks SET `
