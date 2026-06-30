// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * CareOS Patient Data Escrow
 *
 * Flow:
 *   1. Buyer calls fund() with USDC amount + consentHash (sha256 of DUA).
 *   2. Patient signs DUA off-chain; platform calls confirmConsent().
 *   3. Platform confirms data delivery; calls confirmDelivery().
 *   4. Platform calls release() → USDC transfers to patient wallet.
 *   5. Patient can trigger revoke() at any time before release → refund to buyer.
 *
 * PHI never touches the chain. Only:
 *   - consentHash  (sha256 of agreement_id | member_id | buyer | purpose_hash | ts)
 *   - agreementId  (CareOS off-chain DB id)
 *   - bundleHash   (sha256 of FHIR bundle contents)
 *   - payment amounts and status flags
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract CareOSEscrow {

    // ── Events ────────────────────────────────────────────────────────────────

    event Funded(
        uint256 indexed agreementId,
        address indexed buyer,
        address indexed patient,
        uint256 amount,
        bytes32 consentHash
    );
    event ConsentConfirmed(uint256 indexed agreementId, bytes32 consentHash, uint256 timestamp);
    event DeliveryConfirmed(uint256 indexed agreementId, bytes32 bundleHash, uint256 recordCount);
    event PaymentReleased(uint256 indexed agreementId, address indexed patient, uint256 amount);
    event PaymentRefunded(uint256 indexed agreementId, address indexed buyer, uint256 amount);
    event ConsentRevoked(uint256 indexed agreementId, uint256 timestamp);

    // ── State ─────────────────────────────────────────────────────────────────

    enum Status { Empty, Funded, ConsentConfirmed, DeliveryConfirmed, Released, Refunded, Revoked }

    struct Escrow {
        address buyer;
        address patient;
        address token;          // USDC contract address
        uint256 amount;
        bytes32 consentHash;
        bytes32 bundleHash;
        uint256 recordCount;
        uint64  fundedAt;
        uint64  consentAt;
        uint64  deliveryAt;
        uint64  releasedAt;
        Status  status;
    }

    mapping(uint256 => Escrow) public escrows;   // agreementId → Escrow

    address public immutable platform;            // CareOS platform address (multisig in prod)
    uint256 public constant MAX_ESCROW_DAYS = 365;

    modifier onlyPlatform() {
        require(msg.sender == platform, "CareOS: caller is not platform");
        _;
    }

    constructor(address _platform) {
        require(_platform != address(0), "CareOS: zero platform address");
        platform = _platform;
    }

    // ── Buyer funds escrow ────────────────────────────────────────────────────

    function fund(
        uint256 agreementId,
        address patient,
        address token,
        uint256 amount,
        bytes32 consentHash
    ) external {
        require(escrows[agreementId].status == Status.Empty, "CareOS: already funded");
        require(patient != address(0), "CareOS: zero patient address");
        require(amount > 0, "CareOS: zero amount");

        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "CareOS: token transfer failed");

        escrows[agreementId] = Escrow({
            buyer:       msg.sender,
            patient:     patient,
            token:       token,
            amount:      amount,
            consentHash: consentHash,
            bundleHash:  bytes32(0),
            recordCount: 0,
            fundedAt:    uint64(block.timestamp),
            consentAt:   0,
            deliveryAt:  0,
            releasedAt:  0,
            status:      Status.Funded
        });

        emit Funded(agreementId, msg.sender, patient, amount, consentHash);
    }

    // ── Platform confirms patient consent ─────────────────────────────────────

    function confirmConsent(uint256 agreementId, bytes32 consentHash) external onlyPlatform {
        Escrow storage e = escrows[agreementId];
        require(e.status == Status.Funded, "CareOS: not in Funded state");
        require(e.consentHash == consentHash, "CareOS: consent hash mismatch");

        e.status = Status.ConsentConfirmed;
        e.consentAt = uint64(block.timestamp);

        emit ConsentConfirmed(agreementId, consentHash, block.timestamp);
    }

    // ── Platform confirms data delivery ───────────────────────────────────────

    function confirmDelivery(
        uint256 agreementId,
        bytes32 bundleHash,
        uint256 recordCount
    ) external onlyPlatform {
        Escrow storage e = escrows[agreementId];
        require(e.status == Status.ConsentConfirmed, "CareOS: consent not confirmed");

        e.status = Status.DeliveryConfirmed;
        e.bundleHash = bundleHash;
        e.recordCount = recordCount;
        e.deliveryAt = uint64(block.timestamp);

        emit DeliveryConfirmed(agreementId, bundleHash, recordCount);
    }

    // ── Platform releases payment to patient ──────────────────────────────────

    function release(uint256 agreementId) external onlyPlatform {
        Escrow storage e = escrows[agreementId];
        require(e.status == Status.DeliveryConfirmed, "CareOS: delivery not confirmed");

        e.status = Status.Released;
        e.releasedAt = uint64(block.timestamp);

        bool ok = IERC20(e.token).transfer(e.patient, e.amount);
        require(ok, "CareOS: payment transfer failed");

        emit PaymentReleased(agreementId, e.patient, e.amount);
    }

    // ── Patient or platform revokes consent → refund buyer ────────────────────

    function revoke(uint256 agreementId) external {
        Escrow storage e = escrows[agreementId];
        require(
            msg.sender == e.patient || msg.sender == platform,
            "CareOS: only patient or platform can revoke"
        );
        require(
            e.status == Status.Funded || e.status == Status.ConsentConfirmed,
            "CareOS: cannot revoke at this stage"
        );

        e.status = Status.Revoked;

        bool ok = IERC20(e.token).transfer(e.buyer, e.amount);
        require(ok, "CareOS: refund transfer failed");

        emit ConsentRevoked(agreementId, block.timestamp);
        emit PaymentRefunded(agreementId, e.buyer, e.amount);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getEscrow(uint256 agreementId) external view returns (Escrow memory) {
        return escrows[agreementId];
    }

    function statusOf(uint256 agreementId) external view returns (Status) {
        return escrows[agreementId].status;
    }
}
