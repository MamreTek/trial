# Component inventory and parameterized templates

This is an independently implemented Mock prototype. It contains metadata about tools, not their code or binaries. No discovery, installation, real stress tests, boot changes or production requests take place. Hardware names/specifications and all numerical results are synthetic examples, not manufacturer claims. Official-source research was checked on 2026-11-03; references do not imply an installed or validated toolchain.

## Component and tool resources

`GET /api/v1/components` returns normal Page fields plus `facets.manufacturers[]` and `facets.servers[{id,name}]` for the full unfiltered inventory. `q` searches component name/manufacturer/model/slot. Filters are `kind=cpu|memory|disk|network|gpu`, exact manufacturer and serverId; unsupported kind returns 400, unmatched string filters return an empty list. Sort supports name/manufacturer/model and their descending variants. `GET /components/:id` returns 404 for unknown IDs.

HardwareComponent contains id/name/kind, serverId/serverName, manufacturer/model/slot/status, simulated=true, specs[{label,value,unit?}], supportedTools, optional unavailableReason and synthetic sampleMetrics[{label,value,unit}]. Capacity metadata uses memoryMiB/diskGiB/linkMbps and optional gpuApi=cuda|rocm. Samples describe an illustrative profile, not the latest task: stream for memory, 4 KiB random read for disk and single-flow TCP for network. The unit strings are explicit.

The required measurementScope is host-cpu, host-memory, storage-test-file, network-path or gpu-device. This is a product-model inference from the tools' actual measurement boundaries: virtual-memory tests cannot isolate a physical DIMM, and iperf3 measures a network path rather than a standalone NIC's rated performance. Associated component results retain this scope; they are never presented as isolated DIMM/NIC measurements. CPU affinity, file-to-device mapping and physical GPU identity still require a real adapter.

`GET /api/v1/tools` returns ToolDefinition[] in the common success envelope: id/name/revision/license/licenseUrl/docsUrl/workloads/availability/notes/terminationModes/schemas. Availability is mock, external or unverified; mock means only a simulated workflow is available. Schema fields declare key, label, defaultValue, unit and either min/max integer bounds or explicit options. `src/shared/testing.ts` feeds the same schema to form rendering, request validation and this API.

## Parameter and version contract

ScenarioInput optionally accepts a parameters object. Missing keys fill catalog defaults. Null, wrong types, unknown keys or invalid enum/numeric values return 400 with dotted fieldErrors, such as parameters.queueDepth. Tool/workload combinations must match the catalog. toolVersion defaults to the fixed catalog revision and must equal it when supplied. Scenario responses always include parameters/toolVersion/termination.

| Workload / tool | Parameters and limits |
| --- | --- |
| CPU / stress-ng | cpuMethod=all (default) or sqrt; concurrency plans CPU workers, intensityPercent plans CPU load |
| Memory / stress-ng | memoryMode=stream (default) or vm; memoryMiB=64..1048576, default 1024; total shared vm allocation, ignored by stream |
| Disk / fio | diskPattern=randread/read/randwrite/write; blockKiB=1..1024 default 4; queueDepth=1..128 default 32; fileGiB=1..64 default 1 per worker; libaio/direct-I/O plan, isolated files only |
| Network / iperf3 | protocol=tcp/udp; peerId=peer-lab-a/peer-lab-b; bitrateMbps=1..100000 default 100 per flow; concurrency plans parallel streams |
| GPU / gpu-burn | gpuMemoryPercent=1..95 default 80; precision=fp32/fp64; NVIDIA CUDA only |
| HTTP / JMeter or Locust | Existing generic plan fields, no executable scripts or real URL |
| Memtest86+ / SPEC-CPU-unverified | Draft plans only, no tool-specific schema or runnable task |

Generic CPU intensity does not control disk/network/memory/GPU utilization. GPU concurrency is retained plan metadata rather than a gpu-burn worker flag. No arbitrary commands, device paths, physical-memory addresses or peer hostnames are accepted as parameters. Disk writes are also simulated. A real adapter must authorize and reserve isolated test files rather than reuse arbitrary/raw devices.

Capacity checks use the Mock inventory: vm allocation must fit each associated memory record, fileGiB × concurrency must fit the disk, and bitrateMbps × concurrency must fit the link. A real implementation also needs host-level available-memory budgeting and actual device/path validation. The browser's capability fields cannot substitute for server-side probing.

## Duration, rounds and results

termination defaults to `{mode:"duration"}` for mock-ready tools. Duration mode accepts only mode and uses durationMinutes (1..1440) as planned runtime. Rounds mode accepts `{mode:"rounds",rounds:1..1000,roundSeconds:5..3600}`; seconds default to 30, and durationMinutes becomes the overall watchdog limit. Planned rounds × seconds must fit that limit. Rounds represent repeat complete bounded runs in a future adapter, not bogo-ops, inner tool operations or an official benchmark scoring iteration.

External/unverified tools default to rounds=1 and reject roundSeconds; no online adapter semantics are invented. Memtest86+ is an offline boot workflow. CPU_SPEC_2007 remains unresolved and never produces a task or score. Both return 409 TOOL_UNAVAILABLE on job creation even if a caller bypasses disabled UI controls.

JobInput may specify componentIds alongside serverIds. They must be unique, online, compatible, correctly owned and cover each selected server. Legacy server-only requests choose the first compatible component per server in stable inventory order. HTTP has no hardware association. Jobs, reports and exported JSON preserve scenario parameters, reference tool revision, termination and full component snapshots, including measurementScope. Later edits do not change them.

completedRounds is zero/not applicable for duration mode, and an actual simulated count in rounds mode. Success remains an accelerated 15-second demonstration. The existing Mock header can arm one tool failure or timeout; validation errors do not consume it. Failed jobs keep failure.code/message/retryable, cannot be canceled again, and return 409 REPORT_NOT_READY rather than a success report. The failure harness is not a backend task-input field.

Reports retain the original top-level fields and add completedRounds and componentResults[{component,metrics}]. Top-level metrics/curve describe the first associated component, not an aggregate. HTTP has an empty componentResults array. Every result is labeled synthetic; no score can support hardware acceptance.

## Official sources and support boundaries

| Tool | Research result and primary sources |
| --- | --- |
| stress-ng | [Official repository](https://github.com/ColinIanKing/stress-ng), [manual](https://github.com/ColinIanKing/stress-ng/blob/master/stress-ng.1), [stream source](https://github.com/ColinIanKing/stress-ng/blob/master/stress-stream.c). Selected CPU/memory files declare GPL-2.0-or-later. CPU/vm bogo-ops/s compare only like versions/methods; stream exposes read/write rates labeled MB/s and is explicitly not a standard STREAM score. vm allocation is shared by workers. |
| fio | [Official manual](https://fio.readthedocs.io/en/latest/fio_doc.html), [source license](https://github.com/axboe/fio/blob/master/fio.c): GPL-2.0 with per-file exceptions. ioengine determines whether queue depth is meaningful. Future parsing should retain IOPS, convert JSON bw (KiB/s) to MiB/s by /1024, and completion latency percentiles from ns to µs by /1000 when ns is the source field. Never mix read/write or submission/completion latency without labels. |
| iperf3 | [Official invocation](https://software.es.net/iperf/invoking.html), [license](https://github.com/esnet/iperf/blob/master/LICENSE): main BSD-3-Clause plus included third-party notices. Needs a controlled peer; -b limits each stream. Future output normalizes bits/s to Gbit/s (/1e9); TCP retransmits and UDP jitter ms/lost % are protocol-specific, not round-trip latency. |
| gpu-burn | [Official README](https://github.com/wilicc/gpu-burn), [output source](https://github.com/wilicc/gpu-burn/blob/master/gpu_burn-drv.cpp), [BSD-2-Clause license](https://github.com/wilicc/gpu-burn/blob/master/LICENSE). CUDA-specific; no AMD/ROCm assumption. Memory percentage and double precision are documented. Output includes GFLOP/s, comparison errors and temperature when available. CUDA/driver dependencies require their own compatibility/license check before real integration. |
| Memtest86+ | [Official site](https://www.memtest.org/), [readme/license](https://memtest.org/readme): 9.00, released 2026-10-15, GPLv2. Standalone BIOS/UEFI boot tool, distinct from PassMark MemTest86. Documented log/maxpasses mode can stop passes and reboot; no boot or security changes are implemented here. |
| SPEC | [CPU directory](https://www.spec.org/cpu/), [ordering/licensing](https://www.spec.org/order/), [CPU2017 rules](https://www.spec.org/cpu2017/Docs/runrules.html). CPU_SPEC_2007 does not identify a verified edition in that directory; do not substitute 2006/2017/2026. User-supplied license and precise edition remain necessary. CPU2017 retirement is scheduled for 2026-11-17; licenses/reporting rules still matter. No suite or score is included. |
| Existing HTTP tools | [JMeter](https://jmeter.apache.org/) / [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) and [Locust MIT license](https://github.com/locustio/locust/blob/master/LICENSE). Existing Mock workflows remain; scripts are not bundled or executed. |

Pinned source revisions are recorded in the tool API and src/shared/testing.ts. They are research references, not claims of installed releases, driver validation or reproducible hardware execution. No tool code was copied. The memtester author's HTTPS endpoint failed hostname certificate verification during research; validation was not disabled, and an integration/license/version was not inferred from third-party mirrors. Memory testing proceeds with the documented stress-ng model while memtester remains unverified.
