import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { PrismaClient } from '@prisma/client';

const tables = ['User', 'Project', 'TimeEntry', 'ProjectTodo', 'Invoice', 'Payment'] as const;
type Table = (typeof tables)[number];
type Value = string | number | null;

function readStatement(sql: string, start: number) {
  let quoted = false;
  let escaped = false;
  for (let i = start; i < sql.length; i += 1) {
    const char = sql[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === "'") quoted = false;
    } else if (char === "'") quoted = true;
    else if (char === ';') return sql.slice(start, i);
  }
  throw new Error('INSERT statement not terminated');
}

function parseRows(values: string): Value[][] {
  const rows: Value[][] = [];
  let row: Value[] = [];
  let field = '';
  let quoted = false;
  let stringField = false;
  let escaped = false;
  let depth = 0;

  const finishField = () => {
    const raw = field.trim();
    row.push(raw === 'NULL' ? null : stringField ? raw : Number(raw));
    field = '';
    stringField = false;
  };

  for (let i = 0; i < values.length; i += 1) {
    const char = values[i];
    if (quoted) {
      if (escaped) {
        field += ({ '0': '\0', b: '\b', n: '\n', r: '\r', t: '\t', Z: '\u001a' }[char] ?? char);
        escaped = false;
      } else if (char === '\\') escaped = true;
      else if (char === "'") quoted = false;
      else field += char;
      continue;
    }
    if (char === "'") {
      quoted = true;
      stringField = true;
    } else if (char === '(') {
      if (depth === 0) row = [];
      depth += 1;
    } else if (char === ',') {
      if (depth === 1) finishField();
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        finishField();
        rows.push(row);
      }
    } else if (depth > 0) {
      field += char;
    }
  }
  return rows;
}

function rowsFor(sql: string, table: Table) {
  const prefix = `INSERT INTO \`${table}\` VALUES `;
  const start = sql.indexOf(prefix);
  if (start < 0) throw new Error(`Table ${table} was not found in the backup`);
  return parseRows(readStatement(sql, start + prefix.length));
}

function date(value: Value) {
  if (typeof value !== 'string') throw new Error(`Invalid date value: ${value}`);
  return new Date(`${value.replace(' ', 'T')}Z`);
}

function optionalDate(value: Value) {
  return value === null ? null : date(value);
}

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) throw new Error('Usage: yarn db:restore /absolute/path/to/backup.sql.gz');

  const sql = gunzipSync(readFileSync(backupPath)).toString('utf8');
  const [users, projects, timeEntries, todos, invoices, payments] = tables.map((table) => rowsFor(sql, table));
  const imported = Object.fromEntries(tables.map((table, index) => [table, [users, projects, timeEntries, todos, invoices, payments][index].length]));
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify({ validated: imported }, null, 2));
    return;
  }
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(async (db) => {
      await db.user.createMany({ data: users.map(([id, email, passwordHash, name, createdAt, updatedAt]) => ({ id: String(id), email: String(email), passwordHash: String(passwordHash), name: name === null ? null : String(name), createdAt: date(createdAt), updatedAt: date(updatedAt) })), skipDuplicates: true });
      await db.project.createMany({ data: projects.map(([id, userId, name, clientName, description, status, billingMode, fixedTotalAmount, recurringAmount, recurringPeriodType, hourlyRate, currency, startDate, endDate, createdAt, updatedAt]) => ({ id: String(id), userId: String(userId), name: String(name), clientName: clientName === null ? null : String(clientName), description: description === null ? null : String(description), status: String(status) as never, billingMode: String(billingMode) as never, fixedTotalAmount: fixedTotalAmount === null ? null : String(fixedTotalAmount), recurringAmount: recurringAmount === null ? null : String(recurringAmount), recurringPeriodType: recurringPeriodType === null ? null : String(recurringPeriodType) as never, hourlyRate: hourlyRate === null ? null : String(hourlyRate), currency: String(currency), startDate: optionalDate(startDate), endDate: optionalDate(endDate), createdAt: date(createdAt), updatedAt: date(updatedAt) })), skipDuplicates: true });
      await db.timeEntry.createMany({ data: timeEntries.map(([id, projectId, userId, startedAt, endedAt, durationMinutes, note, billingPeriodStart, billingPeriodEnd, createdAt, updatedAt]) => ({ id: String(id), projectId: String(projectId), userId: String(userId), startedAt: date(startedAt), endedAt: optionalDate(endedAt), durationMinutes: durationMinutes === null ? null : Number(durationMinutes), note: note === null ? null : String(note), billingPeriodStart: optionalDate(billingPeriodStart), billingPeriodEnd: optionalDate(billingPeriodEnd), createdAt: date(createdAt), updatedAt: date(updatedAt) })), skipDuplicates: true });
      await db.projectTodo.createMany({ data: todos.map(([id, projectId, title, description, priority, dueDate, completed, completedAt, createdAt, updatedAt]) => ({ id: String(id), projectId: String(projectId), title: String(title), description: description === null ? null : String(description), priority: String(priority) as never, dueDate: optionalDate(dueDate), completed: Boolean(completed), completedAt: optionalDate(completedAt), createdAt: date(createdAt), updatedAt: date(updatedAt) })), skipDuplicates: true });
      await db.invoice.createMany({ data: invoices.map(([id, userId, projectId, issueDate, dueDate, amount, currency, status, externalNumber, notes, periodStart, periodEnd, createdAt, updatedAt]) => ({ id: String(id), userId: String(userId), projectId: projectId === null ? null : String(projectId), issueDate: date(issueDate), dueDate: optionalDate(dueDate), amount: String(amount), currency: String(currency), status: String(status) as never, externalNumber: externalNumber === null ? null : String(externalNumber), notes: notes === null ? null : String(notes), periodStart: optionalDate(periodStart), periodEnd: optionalDate(periodEnd), createdAt: date(createdAt), updatedAt: date(updatedAt) })), skipDuplicates: true });
      await db.payment.createMany({ data: payments.map(([id, invoiceId, userId, projectId, paymentDate, amount, currency, method, notes, createdAt, updatedAt]) => ({ id: String(id), invoiceId: String(invoiceId), userId: String(userId), projectId: projectId === null ? null : String(projectId), paymentDate: date(paymentDate), amount: String(amount), currency: String(currency), method: method === null ? null : String(method), notes: notes === null ? null : String(notes), createdAt: date(createdAt), updatedAt: date(updatedAt) })), skipDuplicates: true });
    }, { timeout: 120_000 });
    console.log(JSON.stringify({ imported }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
