package pt.mygym;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class WorkoutApi {
    private final JdbcTemplate db;

    public WorkoutApi(JdbcTemplate db) { this.db = db; }

    public record ExerciseInput(
        @NotBlank @Size(max = 120) String name,
        @Min(1) @Max(20) int targetSets,
        @Min(1) @Max(100) int targetReps,
        @Min(0) @Max(600) int restSeconds
    ) {}
    public record PlanInput(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 500) String description,
        @NotEmpty List<@Valid ExerciseInput> exercises
    ) {}
    public record Exercise(long id, int position, String name, int targetSets, int targetReps, int restSeconds) {}
    public record Plan(long id, String name, String description, List<Exercise> exercises) {}
    public record SetInput(
        @NotNull BigDecimal weightKg,
        @Min(1) @Max(100) int reps,
        @NotNull Kind kind,
        @DecimalMin("1.0") @DecimalMax("10.0") BigDecimal rpe
    ) {}
    public enum Kind { WARMUP, WORK }
    public record SetEntry(long id, int setNumber, Kind kind, BigDecimal weightKg, int reps, BigDecimal rpe, Instant completedAt) {}
    public record Recommendation(BigDecimal workWeightKg, BigDecimal warmupWeightKg, String reason) {}
    public record SessionExercise(long id, int position, String name, int targetSets, int targetReps,
                                  int restSeconds, List<SetEntry> sets, List<SetEntry> previousSets,
                                  Recommendation recommendation) {}
    public record Session(long id, Long planId, String planName, Instant startedAt, Instant completedAt,
                          String notes, List<SessionExercise> exercises) {}
    public record SessionSummary(long id, String planName, Instant startedAt, Instant completedAt,
                                 int setCount, BigDecimal volumeKg) {}
    public record CompleteInput(@Size(max = 1000) String notes) {}

    private static final RowMapper<Exercise> EXERCISE_MAPPER = (rs, row) -> new Exercise(
        rs.getLong("id"), rs.getInt("position"), rs.getString("name"), rs.getInt("target_sets"),
        rs.getInt("target_reps"), rs.getInt("rest_seconds"));
    private static final RowMapper<SetEntry> SET_MAPPER = (rs, row) -> new SetEntry(
        rs.getLong("id"), rs.getInt("set_number"), Kind.valueOf(rs.getString("kind")),
        rs.getBigDecimal("weight_kg"), rs.getInt("reps"), rs.getBigDecimal("rpe"),
        rs.getTimestamp("completed_at").toInstant());

    @GetMapping("/health")
    public Map<String, String> health() { return Map.of("status", "ok"); }

    @GetMapping("/plans")
    public List<Plan> plans() {
        return db.query("SELECT id, name, description FROM workout_plans ORDER BY created_at DESC, id DESC",
            (rs, row) -> planFromRow(rs));
    }

    @GetMapping("/plans/{id}")
    public Plan plan(@PathVariable long id) {
        return db.query("SELECT id, name, description FROM workout_plans WHERE id = ?",
            (rs, row) -> planFromRow(rs), id).stream().findFirst().orElseThrow(() -> missing("Treino não encontrado."));
    }

    private Plan planFromRow(ResultSet rs) throws SQLException {
        long id = rs.getLong("id");
        return new Plan(id, rs.getString("name"), rs.getString("description"),
            db.query("SELECT * FROM plan_exercises WHERE plan_id = ? ORDER BY position", EXERCISE_MAPPER, id));
    }

    @PostMapping("/plans")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Plan createPlan(@Valid @RequestBody PlanInput input) {
        long id = insert("INSERT INTO workout_plans (name, description) VALUES (?, ?)",
            input.name().trim(), clean(input.description()));
        saveExercises(id, input.exercises());
        return plan(id);
    }

    @PutMapping("/plans/{id}")
    @Transactional
    public Plan updatePlan(@PathVariable long id, @Valid @RequestBody PlanInput input) {
        if (db.update("UPDATE workout_plans SET name = ?, description = ? WHERE id = ?",
            input.name().trim(), clean(input.description()), id) == 0) throw missing("Treino não encontrado.");
        db.update("DELETE FROM plan_exercises WHERE plan_id = ?", id);
        saveExercises(id, input.exercises());
        return plan(id);
    }

    @DeleteMapping("/plans/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePlan(@PathVariable long id) {
        if (db.update("DELETE FROM workout_plans WHERE id = ?", id) == 0) throw missing("Treino não encontrado.");
    }

    private void saveExercises(long planId, List<ExerciseInput> exercises) {
        for (int position = 0; position < exercises.size(); position++) {
            ExerciseInput e = exercises.get(position);
            db.update("INSERT INTO plan_exercises (plan_id, position, name, target_sets, target_reps, rest_seconds) VALUES (?, ?, ?, ?, ?, ?)",
                planId, position, e.name().trim(), e.targetSets(), e.targetReps(), e.restSeconds());
        }
    }

    @PostMapping("/plans/{id}/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Session startSession(@PathVariable long id) {
        Plan plan = plan(id);
        long sessionId = insert("INSERT INTO workout_sessions (plan_id, plan_name) VALUES (?, ?)", id, plan.name());
        for (Exercise e : plan.exercises()) {
            db.update("INSERT INTO session_exercises (session_id, source_exercise_id, position, name, target_sets, target_reps, rest_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)",
                sessionId, e.id(), e.position(), e.name(), e.targetSets(), e.targetReps(), e.restSeconds());
        }
        return session(sessionId);
    }

    @GetMapping("/sessions")
    public List<SessionSummary> sessions() {
        return db.query("""
            SELECT s.id, s.plan_name, s.started_at, s.completed_at,
                   COUNT(ps.id)::int AS set_count,
                   COALESCE(SUM(ps.weight_kg * ps.reps), 0) AS volume_kg
            FROM workout_sessions s
            LEFT JOIN session_exercises se ON se.session_id = s.id
            LEFT JOIN performed_sets ps ON ps.session_exercise_id = se.id AND ps.kind = 'WORK'
            GROUP BY s.id ORDER BY s.started_at DESC, s.id DESC
            """, (rs, row) -> new SessionSummary(rs.getLong("id"), rs.getString("plan_name"),
                rs.getTimestamp("started_at").toInstant(), instant(rs, "completed_at"),
                rs.getInt("set_count"), rs.getBigDecimal("volume_kg")));
    }

    @GetMapping("/sessions/{id}")
    public Session session(@PathVariable long id) {
        return db.query("SELECT * FROM workout_sessions WHERE id = ?", (rs, row) -> {
            Long planId = (Long) rs.getObject("plan_id");
            List<SessionExercise> exercises = new ArrayList<>();
            for (var e : db.query("SELECT * FROM session_exercises WHERE session_id = ? ORDER BY position",
                (exerciseRs, exerciseRow) -> new Object[] {exerciseRs.getLong("id"), exerciseRs.getInt("position"),
                    exerciseRs.getString("name"), exerciseRs.getInt("target_sets"), exerciseRs.getInt("target_reps"),
                    exerciseRs.getInt("rest_seconds")}, id)) {
                long exerciseId = (long) e[0];
                String name = (String) e[2];
                int targetReps = (int) e[4];
                List<SetEntry> current = db.query("SELECT * FROM performed_sets WHERE session_exercise_id = ? ORDER BY set_number", SET_MAPPER, exerciseId);
                List<SetEntry> previous = previousSets(id, planId, name);
                exercises.add(new SessionExercise(exerciseId, (int) e[1], name, (int) e[3], targetReps,
                    (int) e[5], current, previous, ProgressionAdvisor.recommend(previous, targetReps)));
            }
            return new Session(rs.getLong("id"), planId, rs.getString("plan_name"),
                rs.getTimestamp("started_at").toInstant(), instant(rs, "completed_at"),
                rs.getString("notes"), exercises);
        }, id).stream().findFirst().orElseThrow(() -> missing("Sessão não encontrada."));
    }

    private List<SetEntry> previousSets(long sessionId, Long planId, String name) {
        if (planId == null) return List.of();
        List<Long> last = db.query("""
            SELECT se.id FROM session_exercises se
            JOIN workout_sessions s ON s.id = se.session_id
            WHERE s.plan_id = ? AND LOWER(se.name) = LOWER(?) AND s.completed_at IS NOT NULL AND s.id < ?
            ORDER BY s.completed_at DESC, s.id DESC LIMIT 1
            """, (rs, row) -> rs.getLong(1), planId, name, sessionId);
        return last.isEmpty() ? List.of() : db.query(
            "SELECT * FROM performed_sets WHERE session_exercise_id = ? ORDER BY set_number", SET_MAPPER, last.getFirst());
    }

    @PostMapping("/sessions/{sessionId}/exercises/{exerciseId}/sets")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Session addSet(@PathVariable long sessionId, @PathVariable long exerciseId, @Valid @RequestBody SetInput input) {
        if (input.weightKg().compareTo(BigDecimal.ZERO) < 0 || input.weightKg().compareTo(new BigDecimal("2000")) > 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Peso inválido.");
        Session session = session(sessionId);
        if (session.completedAt() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Sessão já terminada.");
        if (session.exercises().stream().noneMatch(e -> e.id() == exerciseId)) throw missing("Exercício não encontrado nesta sessão.");
        Integer number = db.queryForObject("SELECT COALESCE(MAX(set_number), 0) + 1 FROM performed_sets WHERE session_exercise_id = ?", Integer.class, exerciseId);
        db.update("INSERT INTO performed_sets (session_exercise_id, set_number, kind, weight_kg, reps, rpe) VALUES (?, ?, ?, ?, ?, ?)",
            exerciseId, number, input.kind().name(), input.weightKg(), input.reps(), input.rpe());
        return session(sessionId);
    }

    @DeleteMapping("/sessions/{sessionId}/exercises/{exerciseId}/sets/{setId}")
    @Transactional
    public Session removeSet(@PathVariable long sessionId, @PathVariable long exerciseId, @PathVariable long setId) {
        Session session = session(sessionId);
        if (session.completedAt() != null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Sessão já terminada.");
        if (db.update("DELETE FROM performed_sets WHERE id = ? AND session_exercise_id = ? AND session_exercise_id IN (SELECT id FROM session_exercises WHERE session_id = ?)",
            setId, exerciseId, sessionId) == 0) throw missing("Série não encontrada.");
        return session(sessionId);
    }

    @PostMapping("/sessions/{id}/complete")
    @Transactional
    public Session complete(@PathVariable long id, @Valid @RequestBody CompleteInput input) {
        if (db.update("UPDATE workout_sessions SET completed_at = now(), notes = ? WHERE id = ? AND completed_at IS NULL",
            clean(input.notes()), id) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Sessão inexistente ou já terminada.");
        return session(id);
    }

    private long insert(String sql, Object... args) {
        KeyHolder keys = new GeneratedKeyHolder();
        db.update(connection -> {
            var statement = connection.prepareStatement(sql, new String[] {"id"});
            for (int i = 0; i < args.length; i++) statement.setObject(i + 1, args[i]);
            return statement;
        }, keys);
        return keys.getKey().longValue();
    }

    private static String clean(String value) { return value == null ? "" : value.trim(); }
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }
    private static ResponseStatusException missing(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> validation(MethodArgumentNotValidException error) {
        FieldError field = error.getBindingResult().getFieldError();
        return Map.of("message", field == null ? "Dados inválidos." : "Verifica o campo " + field.getField() + ".");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> integrity(DataIntegrityViolationException error) {
        return Map.of("message", "Não foi possível guardar os dados. Verifica os valores e tenta novamente.");
    }
}
